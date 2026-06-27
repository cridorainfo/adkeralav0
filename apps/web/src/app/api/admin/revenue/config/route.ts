import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-guard';

export async function GET(req: NextRequest) {
  const auth = requireRole(req, ['platform_admin']);
  if (!auth.ok) return auth.response;

  const config = await prisma.revenueConfig.findUnique({ where: { id: 'singleton' } });
  return NextResponse.json({ ok: true, data: config });
}

const schema = z.object({
  defaultAdvertiserCpm: z.number().positive(),
  defaultOwnerCpm:      z.number().positive(),
});

export async function PUT(req: NextRequest) {
  const auth = requireRole(req, ['platform_admin']);
  if (!auth.ok) return auth.response;

  const body   = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.message }, { status: 400 });

  if (parsed.data.defaultOwnerCpm >= parsed.data.defaultAdvertiserCpm) {
    return NextResponse.json({ ok: false, error: 'Owner CPM must be less than Advertiser CPM' }, { status: 400 });
  }

  const config = await prisma.revenueConfig.update({
    where: { id: 'singleton' },
    data:  parsed.data,
  });
  return NextResponse.json({ ok: true, data: config });
}
