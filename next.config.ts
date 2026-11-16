import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  devIndicators: false,
  outputFileTracingExcludes: {
    '/*': ['./.env*', './.data/**/*', './tests/**/*', './scripts/**/*'],
  },
};

export default nextConfig;
