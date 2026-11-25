import type { NextConfig } from 'next';

const config: NextConfig = {
  transpilePackages: ['@joker/engine'],
  reactStrictMode: true,
};

export default config;
