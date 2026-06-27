import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-guard';
import { busStore } from '@/server/bus-store';
import { prisma } from '@/lib/prisma';

// GET /api/fleet — all active buses + last known positions for idle buses
export async function GET(req: NextRequest) {
  const auth = requireRole(req, ['platform_admin', 'bus_owner']);
  if (!auth.ok) return auth.response;

  // Active buses from in-memory store
  const active = busStore.active();

  // Also pull buses with last-known GPS from DB (for idle buses not in store)
  const dbBuses = await prisma.bus.findMany({
    where: {
      orgId:   auth.payload.role === 'bus_owner' ? auth.payload.orgId : undefined,
      lastLat: { not: null },
      lastLng: { not: null },
    },
    select: {
      id: true, numberPlate: true, name: true,
      lastLat: true, lastLng: true, lastSeen: true,
    },
    orderBy: { lastSeen: 'desc' },
    take: 200,
  });

  return NextResponse.json({
    ok: true,
    data: {
      active,
      idle: dbBuses
        .filter(b => !active.find(a => a.busId === b.id))
        .map(b => ({
          busId:       b.id,
          numberPlate: b.numberPlate,
          name:        b.name,
          lat:         b.lastLat,
          lng:         b.lastLng,
          lastSeen:    b.lastSeen,
          isIdle:      true,
        })),
    },
  });
}
