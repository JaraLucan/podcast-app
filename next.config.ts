import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root to this project. Without this, Next infers the root
  // from a stray pnpm-lock.yaml in the parent directory (the home folder).
  turbopack: {
    root: import.meta.dirname,
  },
  images: {
    // Podcast artwork comes from third-party CDNs (Apple, Megaphone, etc.).
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

export default nextConfig;
