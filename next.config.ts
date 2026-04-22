import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  compress: true,
  poweredByHeader: false,
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
  images: {
    formats: ['image/avif', 'image/webp'],
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
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  async headers() {
    return [
      {
        source: '/assets/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        source: '/lovable-uploads/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ];
  },
};

export default nextConfig;
