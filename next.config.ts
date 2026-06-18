import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pino", "thread-stream"],
  transpilePackages: [
    "@orbs-network/liquidity-hub-sdk",
  ],
};

export default nextConfig;
