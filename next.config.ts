import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Don't advertise the framework version.
  poweredByHeader: false,

  // Cap the body of server action / route handler requests. The upload route
  // checks file.size itself, but this stops an oversized body being buffered
  // in the first place.
  experimental: {
    serverActions: {
      bodySizeLimit: '6mb',
    },
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          // The study site should not be indexed while participants are testing.
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
      {
        // Never let a proxy or browser cache an API response — they are all
        // per-user and several carry study data.
        source: '/api/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-store, max-age=0' }],
      },
    ]
  },
};

export default nextConfig;
