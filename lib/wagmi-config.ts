import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { useMemo } from "react";
import { http, type Chain } from "viem";
import { SUPPORTED_CHAINS } from "./consts";

const rpcProxyTransport = (chain: Chain) =>
  http(`/api/rpc?chainId=${chain.id}`);

export const useWagmiConfig = (appName: string) => {
  return useMemo(
    () =>
      getDefaultConfig({
        pollingInterval: 60_0000,
        appName,
        projectId: process.env.NEXT_PUBLIC_PROJECT_ID as string,
        chains: SUPPORTED_CHAINS,
        transports: Object.fromEntries(
          SUPPORTED_CHAINS.map((chain) => [
            chain.id,
            rpcProxyTransport(chain),
          ]),
        ) as Record<
          (typeof SUPPORTED_CHAINS)[number]["id"],
          ReturnType<typeof http>
        >,
      }),
    [appName],
  );
};
