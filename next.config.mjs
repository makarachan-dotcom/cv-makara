/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
    // The headless-Chromium PDF stack must stay external — bundling the brotli
    // chromium binary / puppeteer-core breaks the serverless trace.
    serverComponentsExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
  },
  transpilePackages: ["three"],
};

export default nextConfig;
