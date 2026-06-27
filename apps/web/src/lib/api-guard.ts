import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, type TokenPayload } from './auth';

type GuardResult =
  | { ok: true;  payload: TokenPayload }
  | { ok: false; response: NextResponse };

export function requireRole(req: NextRequest, roles: string[]): GuardResult {
  const header = req.headers.get('authorization') ?? '';
  const token  = header.replace('Bearer ', '').trim();

  if (!token) {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 }),
    };
  }

  try {
    const payload = verifyToken(token);
    if (!roles.includes(payload.role)) {
      return {
        ok: false,
        response: NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 }),
      };
    }
    return { ok: true, payload };
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, error: 'Invalid token' }, { status: 401 }),
    };
  }
}

export function requireAuth(req: NextRequest): GuardResult {
  return requireRole(req, ['platform_admin', 'bus_owner', 'driver', 'display', 'advertiser']);
}
