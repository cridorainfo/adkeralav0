import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-guard';

export async function GET(req: NextRequest) {
  const auth = requireRole(req, ['platform_admin']);
  if (!auth.ok) return auth.response;

  const earnings = await prisma.ownerEarnings.findMany({
    include: { org: { select: { name: true } } },
  });

  return NextResponse.json({
    ok: true,
    data: earnings.map(e => ({
      orgId:       e.orgId,
      orgName:     e.org.name,
      totalEarned: e.totalEarned,
      totalPaid:   e.totalPaid,
      balance:     e.totalEarned - e.totalPaid,
    })),
  });
}
