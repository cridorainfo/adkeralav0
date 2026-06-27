import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-guard';

// GET /api/stops?orgId=&q=  — search stops (English + Malayalam)
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const orgId = searchParams.get('orgId');
  const q     = searchParams.get('q') ?? '';

  if (!orgId) return NextResponse.json({ ok: false, error: 'orgId required' }, { status: 400 });

  const stops = await prisma.stop.findMany({
    where: {
      orgId,
      OR: q
        ? [
            { name:   { contains: q, mode: 'insensitive' } },
            { nameMl: { contains: q } },
          ]
        : undefined,
    },
    orderBy: { name: 'asc' },
    take: 50,
  });

  return NextResponse.json({ ok: true, data: stops });
}

const createSchema = z.object({
  orgId:   z.string(),
  name:    z.string().min(1),
  nameMl:  z.string().default(''),
  lat:     z.number(),
  lng:     z.number(),
  geofenceRadius: z.number().default(50),
});

// POST /api/stops  — create stop (platform_admin only)
export async function POST(req: NextRequest) {
  const auth = requireRole(req, ['platform_admin']);
  if (!auth.ok) return auth.response;

  const body   = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.message }, { status: 400 });

  const stop = await prisma.stop.create({ data: parsed.data });
  return NextResponse.json({ ok: true, data: stop }, { status: 201 });
}
