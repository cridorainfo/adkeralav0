/**
 * adkerala – Custom HTTP server
 * Combines Next.js + Socket.IO in one persistent Node.js process.
 * Deployed to Railway (never Vercel — no serverless).
 */

import { createServer } from 'http';
import { parse } from 'url';
import path from 'path';
import next from 'next';
import { Server as SocketIO } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';
import { registerSocketHandlers } from './src/server/socket/index';

const dev  = process.env.NODE_ENV !== 'production';
const port = parseInt(process.env.PORT || '3000', 10);

const app     = next({ dev, dir: path.resolve(__dirname) });
const handle  = app.getRequestHandler();

async function tryConnectRedis(url: string): Promise<[Redis, Redis] | null> {
  const pub = new Redis(url, { lazyConnect: true, enableOfflineQueue: false, maxRetriesPerRequest: 0 });
  const sub = pub.duplicate();

  // Suppress unhandled error events
  pub.on('error', () => {});
  sub.on('error', () => {});

  try {
    await Promise.all([pub.connect(), sub.connect()]);
    return [pub, sub];
  } catch {
    pub.disconnect();
    sub.disconnect();
    return null;
  }
}

app.prepare().then(async () => {
  // ── HTTP server wrapping Next.js ──────────────────────────────────────
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  // ── Socket.IO ─────────────────────────────────────────────────────────
  const ioOptions: ConstructorParameters<typeof SocketIO>[1] = {
    cors: {
      origin: dev ? '*' : [process.env.NEXT_PUBLIC_APP_URL!],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    // Ping every 20 s — important for bus SIM connections that may be flaky
    pingInterval: 20_000,
    pingTimeout: 60_000,
  };

  // ── Redis pub/sub (optional — falls back to in-memory in dev) ────────
  const io = new SocketIO(httpServer, ioOptions);

  if (process.env.REDIS_URL) {
    const clients = await tryConnectRedis(process.env.REDIS_URL);
    if (clients) {
      io.adapter(createAdapter(clients[0], clients[1]));
      console.log('✓ Redis adapter connected');
    } else {
      console.warn('⚠  Redis unavailable — Socket.IO using in-memory adapter (single-process mode)');
    }
  }

  registerSocketHandlers(io);

  // ── Listen ────────────────────────────────────────────────────────────
  httpServer.listen(port, () => {
    console.log(`▲ adkerala ready on http://localhost:${port} [${dev ? 'dev' : 'prod'}]`);
  });
});
