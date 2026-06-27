/**
 * Admin namespace (/admin)
 * Fleet live map, audio listening, bus updates
 */

import type { Namespace } from 'socket.io';
import type { AuthSocket } from './middleware';
import { busStore } from '@/server/bus-store';

export function registerAdminHandlers(ns: Namespace) {
  ns.on('connection', (socket) => {
    const s = socket as AuthSocket;

    if (s.role !== 'platform_admin' && s.role !== 'bus_owner') {
      socket.disconnect();
      return;
    }

    console.log(`[admin] connected: ${s.userId} role=${s.role}`);

    // Subscribe to fleet — immediately send current snapshot
    socket.on('admin:subscribe_fleet', () => {
      socket.join('fleet');
      // Send full current state to the newly subscribed client
      socket.emit('admin:fleet_snapshot', { buses: busStore.active() });
    });

    // Unsubscribe
    socket.on('admin:unsubscribe_fleet', () => {
      socket.leave('fleet');
    });

    // Request fresh snapshot at any time
    socket.on('admin:get_fleet', () => {
      socket.emit('admin:fleet_snapshot', { buses: busStore.active() });
    });

    // Start / stop listening to a specific bus's audio stream
    socket.on('admin:listen_bus', ({ busId }) => {
      socket.join(`listen:${busId}`);
      console.log(`[admin] ${s.userId} listening to bus:${busId}`);
    });

    socket.on('admin:unlisten_bus', ({ busId }) => {
      socket.leave(`listen:${busId}`);
    });

    socket.on('disconnect', () => {
      console.log(`[admin] disconnected: ${s.userId}`);
    });
  });
}
