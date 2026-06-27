import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-guard';

// GET /api/routes?orgId=
export async function GET(req: NextRequest) {
  const auth = requireRole(req, ['platform_admin', 'bus_owner', 'driver']);
  if (!auth.ok) return auth.response;

  const orgId = auth.payload.orgId;

  const routes = await prisma.route.findMany({
    where:   { orgId, active: true },
    include: { stops: { include: { stop: true }, orderBy: { order: 'asc' } }, district: true },
    orderBy: { name: 'asc' },
  });

  return NextResponse.json({ ok: true, data: routes });
}

const createSchema = z.object({
  orgId:      z.string(),
  districtId: z.string(),
  name:       z.string().min(1),
  nameMl:     z.string().default(''),
  stopIds:    z.array(z.string()).min(2),
});

// POST /api/routes  — platform_admin only
export async function POST(req: NextRequest) {
  const auth = requireRole(req, ['platform_admin']);
  if (!auth.ok) return auth.response;

  const body   = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.message }, { status: 400 });

  const { stopIds, ...routeData } = parsed.data;

  const route = await prisma.route.create({
    data: {
      ...routeData,
      stops: {
        create: stopIds.map((stopId, order) => ({ stopId, order })),
      },
    },
    include: { stops: { include: { stop: true }, orderBy: { order: 'asc' } } },
  });

  return NextResponse.json({ ok: true, data: route }, { status: 201 });
}
