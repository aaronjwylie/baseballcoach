import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Coach photos are uploaded through the create/edit Server Actions, which
    // default to a 1 MB body cap — too small for a photo.
    serverActions: { bodySizeLimit: "8mb" },
  },
};

export default nextConfig;
