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
    // TODO: Enable after fixing ~200 `any` types in Phase 5
    ignoreDuringBuilds: true,
  },
  distDir: '.next',
  // Headers required for ffmpeg-wasm (SharedArrayBuffer support)
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'require-corp',
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
