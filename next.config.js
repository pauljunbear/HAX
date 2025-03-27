/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: [],
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  webpack: (config) => {
    config.externals = [...config.externals, { canvas: 'canvas' }];  // required for Konva
    return config;
  },
  typescript: {
    // Temporarily ignore TypeScript errors during build
    ignoreBuildErrors: true,
  },
  experimental: {
    // Explicitly tell Next.js to use the src directory
    appDir: true,
  },
  distDir: '.next',
};

module.exports = nextConfig;
