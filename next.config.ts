import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Pin Next.js's workspace root to this folder so the parent lockfile
  // (one level up in the user's monorepo) doesn't confuse file tracing.
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
