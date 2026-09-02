import type { NextConfig } from "next";

const spotDocsUrl = (
  process.env.NEXT_PUBLIC_SPOT_DOCS_URL ??
  "https://spot-integration-docs.vercel.app"
).replace(/\/$/, "");

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        destination: `${spotDocsUrl}/liquidity-hub`,
        permanent: true,
        source: "/developers/liquidity-hub",
      },
      {
        destination: `${spotDocsUrl}/advanced-orders/direct`,
        permanent: true,
        source: "/developers/orders-sink",
      },
      {
        destination: `${spotDocsUrl}/advanced-orders/direct`,
        permanent: true,
        source: "/developers/orders-sink/direct",
      },
      {
        destination: `${spotDocsUrl}/advanced-orders/react`,
        permanent: true,
        source: "/developers/orders-sink/react",
      },
    ];
  },
  serverExternalPackages: ["pino", "thread-stream"],
  transpilePackages: [
    "@orbs-network/liquidity-hub-sdk",
  ],
};

export default nextConfig;
