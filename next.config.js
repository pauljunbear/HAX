/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    // This is needed for packages that don't work well with webpack 5
    config.resolve.fallback = { fs: false, path: false };
    return config;
  },
  // Specify that we want to use our src directory structure
  distDir: 'dist',
};

module.exports = nextConfig;
