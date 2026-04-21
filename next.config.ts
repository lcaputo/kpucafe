import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'kpucafe.com' },
      { protocol: 'https', hostname: 'storage.googleapis.com' },
      { protocol: 'http', hostname: 'localhost' },
    ],
    localPatterns: [
      { pathname: '/uploads/**' },
      { pathname: '/assets/**' },
      { pathname: '/lovable-uploads/**' },
    ],
  },
};

export default nextConfig;
