/**
 * Driver namespace (/driver)
 * Handles: pairing, GPS push, forward/undo/announce, session end
 */

import type { Namespace } from 'socket.io';
import type { AuthSocket } from './middleware';
import { prisma } from '@/lib/prisma';
import { redis }  from '@/lib/redis';
import { isWithinGeofence } from '@adkerala/utils';
import type { GpsPoint } from '@adkerala/types';
import { busStore } from '@/server/bus-store';

export function registerDriverHandlers(ns: Namespace) {
  ns.on('connection', (socket) => {
    const s = socket as AuthSocket;
    console.log(`[driver] connected: ${s.userId}`);

    // ── Pair with display ──────────────────────────────────────────────
    socket.on('driver:pair', async ({ pairingCode, driverId }) => {
      try {
        const raw = await redis.get(`pairing:${pairingCode}`);
        if (!raw) return socket.emit('driver:error', { code: 'INVALID_CODE', message: 'Invalid or expired pairing code' });

        const pairing = JSON.parse(raw) as { busId: string; displaySocketId: string; expiresAt: number };
        if (Date.now() > pairing.expiresAt) {
          return socket.emit('driver:error', { code: 'CODE_EXPIRED', message: 'Pairing code expired' });
        }

        // Get driver's pre-assigned route or let driver select
        const bus = await prisma.bus.findUnique({
          where: { id: pairing.busId },
          include: {
            routeAssignments: {
              include: { route: { include: { stops: { include: { stop: true }, orderBy: { order: 'asc' } } } } },
              take: 1,
              orderBy: { assignedAt: 'desc' },
            },
          },
        });

        if (!bus) return socket.emit('driver:error', { code: 'BUS_NOT_FOUND', message: 'Bus not found' });

        const route = bus.routeAssignments[0]?.route;
        if (!route) return socket.emit('driver:error', { code: 'NO_ROUTE', message: 'No route assigned to this bus. Ask admin.' });

        // Create journey session
        const session = await prisma.journeySession.create({
          data: {
            busId:   pairing.busId,
            driverId,
            routeId: route.id,
            status:  'active',
          },
        });

        // Store session in Redis for fast lookup
        await redis.set(`session:bus:${pairing.busId}`, session.id, 'EX', 86400);
        await redis.del(`pairing:${pairingCode}`);

        // Join driver socket to bus room
        socket.join(`bus:${pairing.busId}`);

        // Seed bus store so fleet map shows this bus immediately on pairing
        const driver = await prisma.user.findUnique({ where: { id: driverId }, select: { name: true } });
        const stops  = route.stops.sort((a: any, b: any) => a.order - b.order);
        busStore.upsert({
          busId:        pairing.busId,
          sessionId:    session.id,
          numberPlate:  bus.numberPlate,
          routeName:    route.name,
          routeId:      route.id,
          driverName:   driver?.name ?? 'Unknown',
          currentStop:  stops[0]?.stop?.name ?? null,
          nextStop:     stops[1]?.stop?.name ?? null,
          lat:          bus.lastLat ?? 10.52,
          lng:          bus.lastLng ?? 76.21,
          speed:        0,
          heading:      null,
          accuracy:     0,
          updatedAt:    Date.now(),
          silentAlert:  false,
        });

        // Notify admin fleet
        ns.server.of('/admin').to('fleet').emit('admin:bus_update', busStore.get(pairing.busId));

        // Notify display
        ns.server.of('/display').to(`display:${pairing.busId}`).emit('display:session_start', { session, route });

        socket.emit('driver:paired', { sessionId: session.id, busId: pairing.busId, route, currentStopIndex: 0 });
      } catch (err) {
        console.error('[driver:pair]', err);
        socket.emit('driver:error', { code: 'SERVER_ERROR', message: 'Internal error' });
      }
    });

    // ── GPS push ──────────────────────────────────────────────────────
    socket.on('driver:gps', async (data: GpsPoint & { busId: string; sessionId: string }) => {
      // Fan-out to display namespace for this bus
      ns.server.of('/display').to(`display:${data.busId}`).emit('display:gps_update', data);

      // Update in-memory store
      const existing = busStore.get(data.busId);
      if (existing) {
        busStore.upsert({ ...existing, lat: data.lat, lng: data.lng,
          speed: data.speed ?? 0, heading: data.heading ?? null,
          accuracy: data.accuracy ?? 0, updatedAt: Date.now() });
      }

      // Fan-out full bus state to admin fleet watchers
      const busState = busStore.get(data.busId);
      if (busState) {
        ns.server.of('/admin').to('fleet').emit('admin:bus_update', busState);
      }

      // Update bus last position in DB (non-blocking fire-and-forget)
      prisma.bus.update({
        where: { id: data.busId },
        data: { lastLat: data.lat, lastLng: data.lng, lastSeen: new Date() },
      }).catch(() => {});

      // Geofence check for next stop auto-advance
      const nextStopIndex = await autoAdvanceIfNeeded(data, data.busId, data.sessionId, ns, socket);
      void nextStopIndex;
    });

    // ── Manual forward ────────────────────────────────────────────────
    socket.on('driver:forward', async ({ sessionId }) => {
      await advanceStop(sessionId, 1, ns, socket);
    });

    // ── Undo ─────────────────────────────────────────────────────────
    socket.on('driver:undo', async ({ sessionId }) => {
      await advanceStop(sessionId, -1, ns, socket);
    });

    // ── Announce ──────────────────────────────────────────────────────
    socket.on('driver:announce', async ({ sessionId }) => {
      const session = await prisma.journeySession.findUnique({
        where: { id: sessionId },
        include: { route: { include: { stops: { include: { stop: true }, orderBy: { order: 'asc' } } } } },
      });
      if (!session) return;

      const stop = session.route.stops[session.currentStopIndex]?.stop;
      if (!stop) return;

      ns.server.of('/display').to(`display:${session.busId}`).emit('display:announce', { sessionId, stop });
    });

    // ── End session ───────────────────────────────────────────────────
    socket.on('driver:end_session', async ({ sessionId }) => {
      const session = await prisma.journeySession.findUnique({ where: { id: sessionId } });
      if (!session) return;

      await prisma.journeySession.update({
        where: { id: sessionId },
        data: { status: 'ended', endedAt: new Date() },
      });

      await redis.del(`session:bus:${session.busId}`);

      // Remove from fleet store and notify admin
      busStore.remove(session.busId);
      ns.server.of('/admin').to('fleet').emit('admin:bus_removed', { busId: session.busId });

      ns.server.of('/display').to(`display:${session.busId}`).emit('display:session_end', { sessionId });
    });

    socket.on('disconnect', () => {
      console.log(`[driver] disconnected: ${s.userId}`);
    });
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function advanceStop(
  sessionId: string,
  delta: 1 | -1,
  ns: Namespace,
  socket: any
) {
  const session = await prisma.journeySession.findUnique({
    where: { id: sessionId },
    include: { route: { include: { stops: { include: { stop: true }, orderBy: { order: 'asc' } } } } },
  });
  if (!session || session.status !== 'active') return;

  const stops      = session.route.stops;
  const newIndex   = Math.max(0, Math.min(stops.length - 1, session.currentStopIndex + delta));
  if (newIndex === session.currentStopIndex) return;

  await prisma.journeySession.update({ where: { id: sessionId }, data: { currentStopIndex: newIndex } });

  const stop     = stops[newIndex]?.stop;
  const nextStop = stops[newIndex + 1]?.stop ?? null;
  const event    = delta === 1 ? 'display:stop_advance' : 'display:stop_undo';

  const payload = { sessionId, stopIndex: newIndex, stop, nextStop };
  ns.server.of('/display').to(`display:${session.busId}`).emit(event, payload);
  socket.emit('driver:stop_update', { stopIndex: newIndex, stop, nextStop });

  // Keep bus store in sync with current/next stop
  busStore.updateStop(session.busId, stop?.name ?? null, nextStop?.name ?? null);
  const busState = busStore.get(session.busId);
  if (busState) ns.server.of('/admin').to('fleet').emit('admin:bus_update', busState);
}

async function autoAdvanceIfNeeded(
  point: GpsPoint,
  busId: string,
  sessionId: string,
  ns: Namespace,
  socket: any
) {
  const sessionId_ = sessionId || await redis.get(`session:bus:${busId}`);
  if (!sessionId_) return;

  const session = await prisma.journeySession.findUnique({
    where: { id: sessionId_ },
    include: { route: { include: { stops: { include: { stop: true }, orderBy: { order: 'asc' } } } } },
  });
  if (!session || session.status !== 'active') return;

  const stops     = session.route.stops;
  const nextIndex = session.currentStopIndex + 1;
  const nextStop  = stops[nextIndex]?.stop;
  if (!nextStop) return;

  if (isWithinGeofence(point, nextStop as any)) {
    await advanceStop(session.id, 1, ns, socket);
  }
}
