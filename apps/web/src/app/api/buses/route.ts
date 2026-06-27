import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-guard';
import { normaliseNumberPlate } from '@adkerala/utils';
import crypto from 'crypto';

// GET /api/buses?orgId=
export async function GET(req: NextRequest) {
  const auth = requireRole(req, ['platform_admin', 'bus_owner']);
  if (!auth.ok) return auth.response;

  const orgId = auth.payload.role === 'bus_owner' ? auth.payload.orgId : req.nextUrl.searchParams.get('orgId');
  if (!orgId) return NextResponse.json({ ok: false, error: 'orgId required' }, { status: 400 });

  const buses = await prisma.bus.findMany({
    where: { orgId },
    include: {
      routeAssignments: { include: { route: true }, take: 1, orderBy: { assignedAt: 'desc' } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ ok: true, data: buses });
}

const createSchema = z.object({
  orgId:       z.string(),
  numberPlate: z.string().min(4),
  name:        z.string().optional(),
  districtId:  z.string().optional(),
});

// POST /api/buses  — bus_owner adds a bus
export async function POST(req: NextRequest) {
  const auth = requireRole(req, ['platform_admin', 'bus_owner']);
  if (!auth.ok) return auth.response;

  const body   = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.message }, { status: 400 });

  const numberPlate  = normaliseNumberPlate(parsed.data.numberPlate);
  const displayToken = crypto.randomBytes(32).toString('hex');

  const bus = await prisma.bus.create({
    data: { ...parsed.data, numberPlate, displayToken },
  });

  return NextResponse.json({ ok: true, data: { ...bus, displayToken } }, { status: 201 });
}
