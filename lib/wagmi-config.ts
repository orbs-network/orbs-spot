import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { useMemo } from "react";
import { http, type Chain } from "viem";
import { SUPPORTED_CHAINS } from "./consts";
import type { PartnerBrand } from "./partners/types";

const rpcProxyTransport = (chain: Chain) =>
  http(`/api/rpc?chainId=${chain.id}`);

type WagmiConfigOptions = {
  partnerBrand: PartnerBrand;
};

function getAbsoluteUrl(value?: string) {
  if (!value) {
    return undefined;
  }

  try {
    return new URL(value).toString();
  } catch {
    if (typeof window === "undefined") {
      return undefined;
    }

    return new URL(value, window.location.origin).toString();
  }
}

function getAppOrigin() {
  return (
    getAbsoluteUrl(process.env.NEXT_PUBLIC_APP_URL) ??
    (typeof window === "undefined" ? undefined : window.location.origin)
  );
}

export const useWagmiConfig = ({ partnerBrand }: WagmiConfigOptions) => {
  const { iconSrc, metadata, name } = partnerBrand;

  return useMemo(
    () => {
      const projectId = process.env.NEXT_PUBLIC_PROJECT_ID;

      if (!projectId) {
        throw new Error("NEXT_PUBLIC_PROJECT_ID is required to connect wallets");
      }

      const appUrl = getAppOrigin();
      const appIcon = getAbsoluteUrl(iconSrc);

      return getDefaultConfig({
        pollingInterval: 60_0000,
        appName: name,
        appDescription: metadata.description,
        appUrl,
        appIcon,
        projectId,
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
      });
    },
    [iconSrc, metadata.description, name],
  );
};
