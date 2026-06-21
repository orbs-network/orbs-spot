import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import {
  coinbaseWallet,
  metaMaskWallet,
  rainbowWallet,
  safeWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { useMemo } from "react";
import { http, type Chain } from "viem";
import { SUPPORTED_CHAINS } from "./consts";
import type { PartnerBrand } from "./partners/types";

const rpcProxyTransport = (chain: Chain) => http(`/api/rpc?chainId=${chain.id}`);
const METAMASK_WALLETCONNECT_ID =
  "c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96";

type WagmiConfigOptions = {
  partnerBrand: PartnerBrand;
};

function getAbsoluteUrl(value?: string) {
  if (!value) return undefined;

  try {
    return new URL(value).toString();
  } catch {
    if (typeof window === "undefined") return undefined;
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

  return useMemo(() => {
    const projectId = process.env.NEXT_PUBLIC_PROJECT_ID;

    if (!projectId) {
      throw new Error("NEXT_PUBLIC_PROJECT_ID is required to connect wallets");
    }

    const appUrl = getAppOrigin();
    const appIcon =
      getAbsoluteUrl(iconSrc) ?? (appUrl ? `${appUrl}/icon.png` : undefined);

    return getDefaultConfig({
      appName: name,
      appDescription: metadata.description,
      appUrl,
      appIcon,
      projectId,
      walletConnectParameters: {
        qrModalOptions: {
          explorerRecommendedWalletIds: [METAMASK_WALLETCONNECT_ID],
        },
      },

      // 60 seconds
      pollingInterval: 60_000,

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

      wallets: [
        {
          groupName: "Recommended",
          wallets: [
            metaMaskWallet,
            coinbaseWallet,
            rainbowWallet,
            walletConnectWallet,
          ],
        },
        {
          groupName: "More",
          wallets: [safeWallet],
        },
      ],
    });
  }, [iconSrc, metadata.description, name]);
};
