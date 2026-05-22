/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  transpilePackages: ["@hisaflow/types"], // Transpile shared packages
};

module.exports = nextConfig;
