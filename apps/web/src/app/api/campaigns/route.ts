import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-guard';

export async function GET(req: NextRequest) {
  const auth = requireRole(req, ['platform_admin', 'advertiser']);
  if (!auth.ok) return auth.response;

  const campaigns = await prisma.adCampaign.findMany({
    include: { ads: { select: { id: true, format: true } }, advertiser: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ ok: true, data: campaigns });
}

const createSchema = z.object({
  name:           z.string().min(1),
  advertiserCpm:  z.number().positive(),
  ownerCpm:       z.number().positive(),
  totalBudget:    z.number().positive(),
  targetType:     z.enum(['all', 'route', 'district', 'bus']).default('all'),
  startsAt:       z.string().optional(),
  endsAt:         z.string().optional(),
  timeFrom:       z.string().optional(),
  timeTo:         z.string().optional(),
  advertiserId:   z.string().optional(),
});

export async function POST(req: NextRequest) {
  const auth = requireRole(req, ['platform_admin']);
  if (!auth.ok) return auth.response;

  const body   = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.message }, { status: 400 });

  if (parsed.data.ownerCpm >= parsed.data.advertiserCpm) {
    return NextResponse.json({ ok: false, error: 'Owner CPM must be less than Advertiser CPM' }, { status: 400 });
  }

  // Use default advertiser if none provided
  let advertiserId = parsed.data.advertiserId;
  if (!advertiserId) {
    const defaultAdv = await prisma.advertiser.findFirst();
    if (!defaultAdv) {
      return NextResponse.json({ ok: false, error: 'No advertisers exist. Create one first.' }, { status: 400 });
    }
    advertiserId = defaultAdv.id;
  }

  const campaign = await prisma.adCampaign.create({
    data: {
      name:          parsed.data.name,
      advertiserId,
      advertiserCpm: parsed.data.advertiserCpm,
      ownerCpm:      parsed.data.ownerCpm,
      totalBudget:   parsed.data.totalBudget,
      targetType:    parsed.data.targetType,
      startsAt:      parsed.data.startsAt ? new Date(parsed.data.startsAt) : null,
      endsAt:        parsed.data.endsAt   ? new Date(parsed.data.endsAt)   : null,
      timeFrom:      parsed.data.timeFrom || null,
      timeTo:        parsed.data.timeTo   || null,
    },
  });

  return NextResponse.json({ ok: true, data: campaign }, { status: 201 });
}
