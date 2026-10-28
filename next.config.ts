import type { NextConfig } from "next";

const spotDocsUrl = (
  process.env.NEXT_PUBLIC_SPOT_DOCS_URL ??
  "https://docs.orbs.com"
).replace(/\/$/, "");

const nextConfig: NextConfig = {
  devIndicators: false,
  // Deploy runtime variables separately; local env files must not become
  // function dependencies that conflict with .vercelignore during upload.
  outputFileTracingExcludes: {
    "*": [".env*"],
  },
  async redirects() {
    return [
      {
        destination: `${spotDocsUrl}/advanced-orders/direct`,
        permanent: true,
        source: "/developers/liquidity-hub",
        has: [{ type: "query", key: "debug", value: "true" }],
      },
      {
        destination: `${spotDocsUrl}/advanced-orders/direct`,
        permanent: true,
        source: "/developers/orders-sink",
        has: [{ type: "query", key: "debug", value: "true" }],
      },
      {
        destination: `${spotDocsUrl}/advanced-orders/direct`,
        permanent: true,
        source: "/developers/orders-sink/direct",
        has: [{ type: "query", key: "debug", value: "true" }],
      },
      {
        destination: `${spotDocsUrl}/advanced-orders/react`,
        permanent: true,
        source: "/developers/orders-sink/react",
        has: [{ type: "query", key: "debug", value: "true" }],
      },
    ];
  },
  serverExternalPackages: ["pino", "thread-stream"],
};

export default nextConfig;
