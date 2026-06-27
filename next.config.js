// Bundle analyzer - run with ANALYZE=true npm run build
// eslint-disable-next-line @typescript-eslint/no-require-imports
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: [],
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  webpack: config => {
    config.externals = [...config.externals, { canvas: 'canvas' }]; // required for Konva

    // Support for ffmpeg-wasm
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
    };

    config.resolve.alias = {
      ...config.resolve.alias,
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      '@': require('path').resolve(__dirname, 'src'),
    };

    return config;
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  distDir: '.next',
  // NOTE: site-wide COEP/COOP (cross-origin isolation) headers were removed.
  // They existed only to enable SharedArrayBuffer for ffmpeg-wasm, which is not
  // wired into the app, and COEP: require-corp can block loading cross-origin
  // images/scripts. Re-add them scoped to a route if/when video export ships.
};

module.exports = withBundleAnalyzer(nextConfig);
