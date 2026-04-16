/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: { serverComponentsExternalPackages: [] },
  transpilePackages: ["@onboarder/sdk"],
};
module.exports = nextConfig;
