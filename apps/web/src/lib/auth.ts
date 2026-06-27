import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { prisma } from './prisma';

const SECRET = process.env.NEXTAUTH_SECRET!;
const TOKEN_TTL = '7d';

export interface TokenPayload {
  sub: string;    // userId
  role: string;
  orgId: string;
  busId?: string;
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: TOKEN_TTL });
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, SECRET) as TokenPayload;
}

export async function loginUser(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.active) return null;

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return null;

  const token = signToken({ sub: user.id, role: user.role, orgId: user.orgId });
  return { user, token };
}

export async function loginDisplay(busId: string, displayToken: string) {
  const bus = await prisma.bus.findUnique({ where: { id: busId } });
  if (!bus || bus.displayToken !== displayToken) return null;

  const token = signToken({ sub: busId, role: 'display', orgId: bus.orgId, busId });
  return { bus, token };
}

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}
