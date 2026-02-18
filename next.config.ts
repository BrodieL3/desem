import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: '/brief',
        destination: '/',
        permanent: true,
      },
      {
        source: '/briefing',
        destination: '/',
        permanent: true,
      },
    ]
  },
};

export default nextConfig;
