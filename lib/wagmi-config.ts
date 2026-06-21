import {
  getDefaultConfig,
  getWalletConnectConnector,
  type RainbowKitWalletConnectParameters,
  type Wallet,
} from "@rainbow-me/rainbowkit";
import {
  coinbaseWallet,
  metaMaskWallet,
  rainbowWallet,
  safeWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { useMemo } from "react";
import { http, type Chain } from "viem";
import { SUPPORTED_CHAINS } from "./consts";
import type { PartnerBrand } from "./partners/types";

const rpcProxyTransport = (chain: Chain) => http(`/api/rpc?chainId=${chain.id}`);
const METAMASK_WALLETCONNECT_ID =
  "c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96";
const WALLETCONNECT_ICON =
  "data:image/svg+xml,%3Csvg%20width%3D%2228%22%20height%3D%2228%22%20viewBox%3D%220%200%2028%2028%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Crect%20width%3D%2228%22%20height%3D%2228%22%20rx%3D%226%22%20fill%3D%22%233B99FC%22%2F%3E%3Cpath%20d%3D%22M8.39%2010.37c3.1-3.1%208.12-3.1%2011.22%200l.37.37a.4.4%200%200%201%200%20.57l-1.27%201.27a.2.2%200%200%201-.28%200l-.52-.51a5.54%205.54%200%200%200-7.82%200l-.55.55a.2.2%200%200%201-.28%200L7.98%2011.34a.4.4%200%200%201%200-.56l.41-.41Zm13.86%202.64%201.13%201.14a.4.4%200%200%201%200%20.56l-5.12%205.12a.4.4%200%200%201-.56%200l-3.63-3.63a.1.1%200%200%200-.14%200l-3.63%203.63a.4.4%200%200%201-.56%200l-5.12-5.12a.4.4%200%200%201%200-.56l1.13-1.14a.4.4%200%200%201%20.56%200l3.64%203.64a.1.1%200%200%200%20.14%200l3.63-3.64a.4.4%200%200%201%20.56%200l3.63%203.64a.1.1%200%200%200%20.14%200l3.63-3.64a.4.4%200%200%201%20.57%200Z%22%20fill%3D%22white%22%2F%3E%3C%2Fsvg%3E";

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
    walletConnectParameters,
  });

  return {
    id: "walletConnectModal",
    name: "WalletConnect",
    iconUrl: WALLETCONNECT_ICON,
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
        customStoragePrefix: "efficient-frontier-swap",
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
  }, [iconSrc, metadata.description, name]);
};
