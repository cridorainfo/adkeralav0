import { Redis } from 'ioredis';

const globalForRedis = globalThis as unknown as { redis: Redis | null };

function createRedis(): Redis | null {
  if (!process.env.REDIS_URL) return null;
  try {
    const client = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
      retryStrategy: (times) => {
        if (process.env.NODE_ENV !== 'production') {
          // In dev, stop retrying after a few attempts to avoid log spam
          if (times > 3) return null;
        }
        return Math.min(times * 500, 5000);
      },
    });
    return client;
  } catch {
    return null;
  }
}

export const redis: Redis | null =
  globalForRedis.redis !== undefined
    ? globalForRedis.redis
    : createRedis();

if (process.env.NODE_ENV !== 'production') {
  globalForRedis.redis = redis;
}
