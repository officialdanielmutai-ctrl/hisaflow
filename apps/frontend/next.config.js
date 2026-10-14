/** @type {import("next").NextConfig} */
const path = require('path');

const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  webpack: (config, { dev }) => {
    // Test-only: swap Clerk for the stub used by the seeded Duty 1 sweep.
    // Never active unless NEXT_PUBLIC_E2E_AUTH is explicitly "true".
    if (process.env.NEXT_PUBLIC_E2E_AUTH === 'true') {
      // The trailing `$` makes this an exact match, so
      // `@clerk/nextjs/server` (used by the middleware) is left untouched.
      config.resolve.alias['@clerk/nextjs$'] = path.resolve(
        __dirname,
        'lib/e2e/clerk-stub.tsx',
      );
    }
    if (dev) {
      config.cache = false;
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
        ignored: ['**/node_modules/**', '**/.git/**', '**/.next/**'],
      };
    }
    return config;
  },
};

const withSerwist = require("@serwist/next").default({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});

module.exports = withSerwist(nextConfig);
