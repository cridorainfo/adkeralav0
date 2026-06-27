import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { loginUser } from '@/lib/auth';

const schema = z.object({
  email:    z.string().email(),
  password: z.string().min(6),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Invalid input' }, { status: 400 });

  const result = await loginUser(parsed.data.email, parsed.data.password);
  if (!result) return NextResponse.json({ ok: false, error: 'Invalid credentials' }, { status: 401 });

  return NextResponse.json({
    ok: true,
    data: {
      token: result.token,
      user: {
        id:    result.user.id,
        name:  result.user.name,
        role:  result.user.role,
        orgId: result.user.orgId,
      },
    },
  });
}
