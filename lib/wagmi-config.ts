import {
  getDefaultConfig,
  getWalletConnectConnector,
  type RainbowKitWalletConnectParameters,
  type Wallet,
} from "@rainbow-me/rainbowkit";
import {
  coinbaseWallet,
  metaMaskWallet,
  phantomWallet,
  rabbyWallet,
  rainbowWallet,
  safeWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { useMemo } from "react";
import { http, type Chain } from "viem";
import { SUPPORTED_CHAINS } from "./consts";
import type { PartnerBrand } from "./partners/types";
import { getActiveClientPartnerConfig } from "./partners/client";
import { hasOrbsConnectModal } from "./partners/features";

const rpcProxyTransport = (chain: Chain) => http(`/api/rpc?chainId=${chain.id}`);
const METAMASK_WALLETCONNECT_ID =
  "c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96";
const WALLETCONNECT_STORAGE_PREFIX = "efficient-frontier-swap";

type WagmiConfigOptions = {
  partnerBrand: PartnerBrand;
};

const walletConnectModalWallet = ({
  projectId,
  walletConnectParameters,
}: {
  projectId: string;
  walletConnectParameters?: RainbowKitWalletConnectParameters;
}): Wallet => {
  const createWalletConnectConnector = getWalletConnectConnector({
    projectId,
    walletConnectParameters: {
      ...walletConnectParameters,
      // RainbowKit creates separate providers for wallet links and the QR modal.
      // Sharing their namespace also shares a Core and duplicates heartbeat listeners.
      customStoragePrefix: `${WALLETCONNECT_STORAGE_PREFIX}-qr`,
    },
  });

  return {
    id: "walletConnectModal",
    name: "WalletConnect",
    iconUrl: "/wallet-connect.svg",
    iconBackground: "#3b99fc",
    createConnector: (walletDetails) =>
      createWalletConnectConnector({
        rkDetails: {
          ...walletDetails.rkDetails,
          showQrModal: true,
        },
      }),
  };
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
  const customConnectModal = hasOrbsConnectModal(getActiveClientPartnerConfig());

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
      ssr: true,
      walletConnectParameters: {
        customStoragePrefix: WALLETCONNECT_STORAGE_PREFIX,
        isNewChainsStale: false,
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
            ...(customConnectModal ? [phantomWallet, rabbyWallet] : []),
            coinbaseWallet,
            rainbowWallet,
            walletConnectModalWallet,
          ],
        },
        {
          groupName: "More",
          wallets: [safeWallet],
        },
      ],
    });
  }, [customConnectModal, iconSrc, metadata.description, name]);
};
