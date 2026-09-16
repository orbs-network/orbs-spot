import type { NextConfig } from "next";

const spotDocsUrl = (
  process.env.NEXT_PUBLIC_SPOT_DOCS_URL ??
  "https://docs.orbs.com"
).replace(/\/$/, "");

const nextConfig: NextConfig = {
  async rewrites() {
    const hosts: Record<number, string> = {
      1: "hub.orbs.network",
      56: "bsc.hub.orbs.network",
      137: "polygon.hub.orbs.network",
      146: "sonic.hub.orbs.network",
      250: "ftm.hub.orbs.network",
      1101: "zkevm.hub.orbs.network",
      8453: "base.hub.orbs.network",
      42161: "arbi.hub.orbs.network",
      59144: "linea.hub.orbs.network",
      81457: "blast.hub.orbs.network",
    };

    return Object.entries(hosts).flatMap(([chainId, host]) =>
      ["quote", "swap-async", "swap/status/:sessionId"].map((path) => ({
        source: `/api/liquidity-hub/${chainId}/${path}`,
        destination: `https://${host}/${path}`,
      })),
    );
  },
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
