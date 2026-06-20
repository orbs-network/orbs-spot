import {
  getDefaultConfig,
  getWalletConnectConnector,
  type WalletList,
} from "@rainbow-me/rainbowkit";
import {
  coinbaseWallet,
  metaMaskWallet,
  rainbowWallet,
  safeWallet,
  uniswapWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { useMemo } from "react";
import { http, type Chain } from "viem";
import { SUPPORTED_CHAINS } from "./consts";
import type { PartnerBrand } from "./partners/types";

const rpcProxyTransport = (chain: Chain) =>
  http(`/api/rpc?chainId=${chain.id}`);

type WagmiConfigOptions = {
  partnerBrand: PartnerBrand;
};

type CreateWallet = WalletList[number]["wallets"][number];

function isMobileBrowser() {
  if (typeof navigator === "undefined") {
    return false;
  }

  return /android|iphone|ipad|ipod/i.test(navigator.userAgent);
}

function hasInjectedMetaMask() {
  if (typeof window === "undefined") {
    return false;
  }

  const ethereum = (window as typeof window & {
    ethereum?: { isMetaMask?: boolean };
  }).ethereum;

  return Boolean(ethereum?.isMetaMask);
}

const desktopOnlyWallet =
  (createWallet: CreateWallet): CreateWallet =>
  (params) => {
    const wallet = createWallet(params);
    const hidden = wallet.hidden;

    return {
      ...wallet,
      hidden: () => isMobileBrowser() || hidden?.() === true,
    };
  };

const metaMaskWalletWithMobileWalletConnect: CreateWallet = (params) => {
  const wallet = metaMaskWallet(params);

  if (!isMobileBrowser() || hasInjectedMetaMask()) {
    return wallet;
  }

  const getUri = (uri: string) =>
    `https://metamask.app.link/wc?uri=${encodeURIComponent(uri)}`;

  return {
    ...wallet,
    mobile: { getUri },
    qrCode: wallet.qrCode ? { ...wallet.qrCode, getUri } : { getUri },
    createConnector: getWalletConnectConnector({
      projectId: params.projectId,
      walletConnectParameters: params.walletConnectParameters,
    }),
  };
};

const desktopWalletConnectWallet = desktopOnlyWallet(walletConnectWallet);

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
        wallets: [
          {
            groupName: "Recommended",
            wallets: [
              metaMaskWalletWithMobileWalletConnect,
              coinbaseWallet,
              rainbowWallet,
              desktopWalletConnectWallet,
            ],
          },
          {
            groupName: "More",
            wallets: [
              safeWallet,
            ],
          },
        ],
      });
    },
    [iconSrc, metadata.description, name],
  );
};
