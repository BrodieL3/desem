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
  webpack: (config) => {
    config.watchOptions = {
      ...config.watchOptions,
      ignored: [
        '**/node_modules/**',
        '**/*.csv',
        '**/FY2025_All_Contracts_Full_20260206/**',
        '**/data/**',
      ],
    }
    return config
  },
};

export default nextConfig;
