import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow large image/file uploads via server actions (photos from staff phones).
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
