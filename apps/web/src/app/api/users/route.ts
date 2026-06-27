import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-guard';
import { hashPassword } from '@/lib/auth';

// GET /api/users?role=driver&orgId=
export async function GET(req: NextRequest) {
  const auth = requireRole(req, ['platform_admin', 'bus_owner']);
  if (!auth.ok) return auth.response;

  const { searchParams } = req.nextUrl;
  const role  = searchParams.get('role') ?? undefined;
  const orgId = auth.payload.role === 'bus_owner' ? auth.payload.orgId : searchParams.get('orgId') ?? auth.payload.orgId;

  const users = await prisma.user.findMany({
    where: { orgId, ...(role ? { role: role as any } : {}) },
    select: { id: true, name: true, email: true, phone: true, role: true, active: true, createdAt: true },
    orderBy: { name: 'asc' },
  });

  return NextResponse.json({ ok: true, data: users });
}

const createSchema = z.object({
  orgId:    z.string(),
  name:     z.string().min(1),
  email:    z.string().email().optional().or(z.literal('')),
  phone:    z.string().optional(),
  password: z.string().min(6),
  role:     z.enum(['driver', 'bus_owner']),
});

// POST /api/users — create driver (bus_owner or platform_admin)
export async function POST(req: NextRequest) {
  const auth = requireRole(req, ['platform_admin', 'bus_owner']);
  if (!auth.ok) return auth.response;

  const body   = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.message }, { status: 400 });

  // bus_owner can only create drivers in own org
  if (auth.payload.role === 'bus_owner' && parsed.data.orgId !== auth.payload.orgId) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }

  const password = await hashPassword(parsed.data.password);
  const user = await prisma.user.create({
    data: {
      orgId:    parsed.data.orgId,
      name:     parsed.data.name,
      email:    parsed.data.email || null,
      phone:    parsed.data.phone || null,
      role:     parsed.data.role,
      password,
    },
    select: { id: true, name: true, email: true, phone: true, role: true, active: true },
  });

  return NextResponse.json({ ok: true, data: user }, { status: 201 });
}
