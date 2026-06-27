/**
 * adkerala Service Worker
 * Responsibilities:
 *  1. Cache offline assets (app shell, route/stop data)
 *  2. GPS background sync via Background Sync API
 *  3. Show persistent notification to keep PWA "alive" (user must keep tab open)
 */

const CACHE_NAME   = 'adkerala-v1';
const OFFLINE_URLS = [
  '/driver',
  '/driver/journey',
  '/offline.html',
];

// ── Install: cache app shell ───────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(OFFLINE_URLS))
  );
  self.skipWaiting();
});

// ── Activate: clean old caches ────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch: network-first for API, cache-first for assets ─────────────────────
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // API calls always go to network
  if (url.pathname.startsWith('/api/')) return;
  // Socket.IO always to network
  if (url.pathname.startsWith('/socket.io/')) return;

  event.respondWith(
    fetch(event.request)
      .catch(() => caches.match(event.request).then((r) => r || caches.match('/offline.html')))
  );
});

// ── Background Sync: flush GPS queue when back online ────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'gps-flush') {
    event.waitUntil(flushGpsQueue());
  }
});

async function flushGpsQueue() {
  // Points are stored in IndexedDB by the PWA main thread
  // SW signals main thread to flush via postMessage
  const clients = await self.clients.matchAll({ type: 'window' });
  clients.forEach((c) => c.postMessage({ type: 'FLUSH_GPS_QUEUE' }));
}

// ── Push: receive push notification (keep-alive ping from server) ─────────────
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  if (data.type === 'keepalive') return; // silent, just wakes SW

  event.waitUntil(
    self.registration.showNotification(data.title || 'adkerala', {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-72.png',
      tag: 'adkerala-driver',
      renotify: false,
      silent: true,
    })
  );
});

// ── Notification click: bring app to foreground ───────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes('/driver') && 'focus' in client) return client.focus();
        }
        return self.clients.openWindow('/driver/journey');
      })
  );
});
