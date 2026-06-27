/**
 * GET /api/ads/eligible?busId=&routeId=&districtId=
 * Returns ads eligible to play on this bus right now.
 * Called by the display device at session start + after each ad plays.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-guard';
import { isWithinTimeWindow } from '@adkerala/utils';

export async function GET(req: NextRequest) {
  const auth = requireRole(req, ['display', 'platform_admin']);
  if (!auth.ok) return auth.response;

  const { searchParams } = req.nextUrl;
  const busId      = searchParams.get('busId')!;
  const routeId    = searchParams.get('routeId')!;
  const districtId = searchParams.get('districtId')!;

  // Fetch all active campaigns
  const campaigns = await prisma.adCampaign.findMany({
    where: { status: 'active' },
    include: {
      ads:            { where: { active: true } },
      routeTargets:   true,
      districtTargets: true,
      busTargets:     true,
    },
  });

  const now = new Date();

  const eligible = campaigns
    .filter((c) => {
      // Budget not exhausted
      if (c.spentAmount >= c.totalBudget) return false;
      // Date window
      if (c.startsAt && now < c.startsAt) return false;
      if (c.endsAt   && now > c.endsAt)   return false;
      // Time of day window
      if (!isWithinTimeWindow(c.timeFrom, c.timeTo)) return false;
      // Targeting
      if (c.targetType === 'all') return true;
      if (c.targetType === 'route'    && c.routeTargets.some(r => r.routeId === routeId))       return true;
      if (c.targetType === 'district' && c.districtTargets.some(d => d.districtId === districtId)) return true;
      if (c.targetType === 'bus'      && c.busTargets.some(b => b.busId === busId))              return true;
      return false;
    })
    .flatMap((c) => c.ads.map((ad) => ({
      id:             ad.id,
      campaignId:     c.id,
      format:         ad.format,
      mediaUrl:       ad.mediaUrl,
      durationSeconds: ad.durationSeconds,
      advertiserCpm:  c.advertiserCpm,
      ownerCpm:       c.ownerCpm,
    })));

  return NextResponse.json({ ok: true, data: eligible });
}
