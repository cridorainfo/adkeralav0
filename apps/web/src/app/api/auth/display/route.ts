import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { loginDisplay } from '@/lib/auth';

const schema = z.object({
  busId:        z.string(),
  displayToken: z.string(),
});

export async function POST(req: NextRequest) {
  const body   = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Invalid input' }, { status: 400 });

  const result = await loginDisplay(parsed.data.busId, parsed.data.displayToken);
  if (!result) return NextResponse.json({ ok: false, error: 'Invalid display token' }, { status: 401 });

  return NextResponse.json({
    ok: true,
    data: {
      token: result.token,
      bus: { id: result.bus.id, numberPlate: result.bus.numberPlate },
    },
  });
}
