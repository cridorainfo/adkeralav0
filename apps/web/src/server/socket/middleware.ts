import type { Socket } from 'socket.io';
import jwt from 'jsonwebtoken';

export interface AuthSocket extends Socket {
  userId: string;
  role: string;
  orgId: string;
  busId?: string;
}

export function authMiddleware(socket: Socket, next: (err?: Error) => void) {
  const token =
    socket.handshake.auth?.token ||
    socket.handshake.headers?.authorization?.replace('Bearer ', '');

  if (!token) {
    return next(new Error('AUTH_REQUIRED'));
  }

  try {
    const payload = jwt.verify(token, process.env.NEXTAUTH_SECRET!) as {
      sub: string;
      role: string;
      orgId: string;
      busId?: string;
    };

    (socket as AuthSocket).userId = payload.sub;
    (socket as AuthSocket).role   = payload.role;
    (socket as AuthSocket).orgId  = payload.orgId;
    (socket as AuthSocket).busId  = payload.busId;

    next();
  } catch {
    next(new Error('AUTH_INVALID'));
  }
}
