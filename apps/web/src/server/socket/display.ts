/**
 * Display namespace (/display)
 * Handles: display registration, impression logging, audio monitoring
 */

import type { Namespace } from 'socket.io';
import type { AuthSocket } from './middleware';
import { prisma } from '@/lib/prisma';
import { redis }  from '@/lib/redis';
import { generatePairingCode } from '@adkerala/utils';
import type { ImpressionPayload } from '@adkerala/types';

const PAIRING_TTL_SECONDS = 300; // 5 minutes

export function registerDisplayHandlers(ns: Namespace) {
  ns.on('connection', async (socket) => {
    const s = socket as AuthSocket;
    const busId = s.busId;

    if (!busId) {
      socket.disconnect();
      return;
    }

    console.log(`[display] connected: bus=${busId}`);

    // Join bus-specific room
    socket.join(`display:${busId}`);

    // Generate pairing code and store in Redis
    const code = generatePairingCode();
    const pairingPayload = {
      busId,
      displaySocketId: socket.id,
      expiresAt: Date.now() + PAIRING_TTL_SECONDS * 1000,
    };
    await redis.set(`pairing:${code}`, JSON.stringify(pairingPayload), 'EX', PAIRING_TTL_SECONDS);

    // Send pairing code to the display so it can show it on screen
    socket.emit('display:pairing_code', { code, expiresInSeconds: PAIRING_TTL_SECONDS });

    // Refresh pairing code when it expires (display is still connected)
    const refreshTimer = setInterval(async () => {
      const newCode = generatePairingCode();
      const newPayload = { busId, displaySocketId: socket.id, expiresAt: Date.now() + PAIRING_TTL_SECONDS * 1000 };
      await redis.set(`pairing:${newCode}`, JSON.stringify(newPayload), 'EX', PAIRING_TTL_SECONDS);
      socket.emit('display:pairing_code', { code: newCode, expiresInSeconds: PAIRING_TTL_SECONDS });
    }, (PAIRING_TTL_SECONDS - 10) * 1000);

    // ── Impression logging ─────────────────────────────────────────────
    socket.on('display:impression', async (payload: ImpressionPayload) => {
      try {
        // Fetch campaign CPMs at log time (authoritative, not from client)
        const campaign = await prisma.adCampaign.findUnique({ where: { id: payload.campaignId } });
        if (!campaign) return;

        const advertiserCharge = campaign.advertiserCpm / 1000;
        const ownerEarning     = campaign.ownerCpm / 1000;
        const platformMargin   = advertiserCharge - ownerEarning;

        // Atomic transaction: log impression + update campaign spent + update owner earnings
        const bus = await prisma.bus.findUnique({ where: { id: payload.busId } });
        if (!bus) return;

        await prisma.$transaction([
          prisma.impression.create({
            data: {
              adId:            payload.adId,
              campaignId:      payload.campaignId,
              busId:           payload.busId,
              sessionId:       payload.sessionId,
              routeId:         payload.routeId,
              districtId:      payload.districtId,
              format:          payload.format,
              durationSeconds: payload.durationSeconds,
              advertiserCharge,
              ownerEarning,
              platformMargin,
              advertisedAt:    new Date(payload.advertisedAt),
            },
          }),
          prisma.adCampaign.update({
            where: { id: payload.campaignId },
            data: { spentAmount: { increment: advertiserCharge } },
          }),
          prisma.ownerEarnings.upsert({
            where: { orgId: bus.orgId },
            update: { totalEarned: { increment: ownerEarning } },
            create: { orgId: bus.orgId, totalEarned: ownerEarning, totalPaid: 0 },
          }),
          // Auto-exhaust campaign if budget reached
          prisma.adCampaign.updateMany({
            where: { id: payload.campaignId, spentAmount: { gte: campaign.totalBudget } },
            data: { status: 'exhausted' },
          }),
        ]);
      } catch (err) {
        console.error('[display:impression]', err);
      }
    });

    // ── Audio monitoring ───────────────────────────────────────────────
    socket.on('display:audio_chunk', ({ busId: bid, sessionId, chunk }) => {
      // Forward to any admin sockets listening to this bus
      ns.server.of('/admin').to(`listen:${bid}`).emit('admin:audio_chunk', { busId: bid, chunk });
    });

    socket.on('display:audio_event', async ({ busId: bid, sessionId, event, stopName }) => {
      // Persist silent event
      if (event === 'silent') {
        await prisma.audioSilentEvent.create({
          data: { busId: bid, sessionId, stopName, occurredAt: new Date() },
        }).catch(() => {});
      }

      // Alert admins
      ns.server.of('/admin').to('fleet').emit('admin:audio_event', { busId: bid, event, sessionId, stopName });
    });

    socket.on('disconnect', async () => {
      clearInterval(refreshTimer);
      console.log(`[display] disconnected: bus=${busId}`);
    });
  });
}
