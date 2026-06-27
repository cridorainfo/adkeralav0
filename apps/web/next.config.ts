import type { NextConfig } from 'next';

const config: NextConfig = {
  serverExternalPackages: ['socket.io', 'ioredis', '@prisma/client'],

  // PWA headers for service worker scope
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Service-Worker-Allowed', value: '/' },
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
        ],
      },
      {
        source: '/manifest.json',
        headers: [{ key: 'Content-Type', value: 'application/manifest+json' }],
      },
    ];
  },

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.r2.dev',
      },
      {
        protocol: 'https',
        hostname: 'media.adkerala.in',
      },
    ],
  },
};

export default config;
