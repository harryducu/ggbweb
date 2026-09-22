import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // There is a package-lock.json in the parent directory, so pin the trace root
  // here or Next infers the wrong workspace and resolves modules against it.
  outputFileTracingRoot: path.join(__dirname),
  // Lets a second dev server (or a production build) run alongside the first
  // without them fighting over the same build directory.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  experimental: {
    serverActions: { bodySizeLimit: "8mb" },
  },
};

export default nextConfig;
