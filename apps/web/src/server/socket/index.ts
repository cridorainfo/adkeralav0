import type { Server } from 'socket.io';
import { registerDriverHandlers }  from './driver';
import { registerDisplayHandlers } from './display';
import { registerAdminHandlers }   from './admin';
import { authMiddleware }          from './middleware';

export function registerSocketHandlers(io: Server) {
  io.use(authMiddleware);

  // Namespace: /driver  — driver PWA phones
  const driverNs  = io.of('/driver');
  driverNs.use(authMiddleware);
  registerDriverHandlers(driverNs);

  // Namespace: /display — Electron/Android display kiosks
  const displayNs = io.of('/display');
  displayNs.use(authMiddleware);
  registerDisplayHandlers(displayNs);

  // Namespace: /admin   — admin dashboard
  const adminNs   = io.of('/admin');
  adminNs.use(authMiddleware);
  registerAdminHandlers(adminNs);
}
