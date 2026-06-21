"use client";
import React, { Suspense, useEffect, useRef } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { darkTheme, RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { Spinner } from "@/components/ui/spinner";
import dynamic from "next/dynamic";
import { useConnect, useConnection, useReconnect, WagmiProvider } from "wagmi";
import type { PartnerBrand, PartnerStyles } from "./partners/types";
import { QueryProvider } from "./query-provider";
import { useWagmiConfig } from "./wagmi-config";

const AppProvider = dynamic(
  () => import("./context").then((mod) => mod.AppProvider),
  { ssr: false },
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
    mutations: {
      retry: 0,
    },
  },
});

const Fallback = () => {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background">
      <Spinner className="size-20" />
    </div>
  );
};

type WalletConnectProviderWithSession = {
  session?: unknown;
};

const hasWalletConnectSession = (
  provider: unknown,
): provider is WalletConnectProviderWithSession => {
  return Boolean(
    provider &&
      typeof provider === "object" &&
      "session" in provider &&
      (provider as WalletConnectProviderWithSession).session,
  );
};

const WalletReturnReconnect = () => {
  const { address, isConnected, isConnecting, isReconnecting } =
    useConnection();
  const { connectors, mutateAsync: connect } = useConnect();
  const { mutateAsync: reconnect } = useReconnect();
  const lastReconnectAt = useRef(0);
  const reconnectInFlight = useRef(false);

  useEffect(() => {
    let reconnectTimer: number | undefined;
    let cancelled = false;

    const reconnectIfNeeded = async () => {
      if (document.visibilityState !== "visible") {
        return;
      }

      if (address || isConnected || isReconnecting || reconnectInFlight.current) {
        return;
      }

      const now = Date.now();
      if (now - lastReconnectAt.current < 1_500) {
        return;
      }

      lastReconnectAt.current = now;
      reconnectInFlight.current = true;

      try {
        const connections = isConnecting ? [] : await reconnect();
        if (cancelled || connections.length > 0) {
          return;
        }

        const walletConnectConnector = connectors.find(
          (connector) => connector.id === "walletConnect",
        );
        if (!walletConnectConnector) {
          return;
        }

        const provider = await walletConnectConnector
          .getProvider()
          .catch(() => undefined);
        if (cancelled || !hasWalletConnectSession(provider)) {
          return;
        }

        await connect({ connector: walletConnectConnector });
      } catch {
        // WalletConnect can leave an approved mobile session in storage before
        // Wagmi has accounts. The next focus/pageshow will try again.
      } finally {
        reconnectInFlight.current = false;
      }
    };

    const queueReconnect = () => {
      if (reconnectTimer) {
        window.clearTimeout(reconnectTimer);
      }

      reconnectTimer = window.setTimeout(() => {
        void reconnectIfNeeded();
      }, 400);
    };

    window.addEventListener("focus", queueReconnect);
    window.addEventListener("pageshow", queueReconnect);
    document.addEventListener("visibilitychange", queueReconnect);
    queueReconnect();

    return () => {
      cancelled = true;
      if (reconnectTimer) {
        window.clearTimeout(reconnectTimer);
      }
      window.removeEventListener("focus", queueReconnect);
      window.removeEventListener("pageshow", queueReconnect);
      document.removeEventListener("visibilitychange", queueReconnect);
    };
  }, [
    address,
    connect,
    connectors,
    isConnected,
    isConnecting,
    isReconnecting,
    reconnect,
  ]);

  return null;
};

const WagmiWrapper = ({
  children,
  partnerBrand,
}: {
  children: React.ReactNode;
  partnerBrand: PartnerBrand;
}) => {
  const config = useWagmiConfig({ partnerBrand });

  return (
    <WagmiProvider config={config}>
      {children}
    </WagmiProvider>
  );
};

export function Providers({
  children,
  partnerBrand,
  partnerStyles,
}: {
  children: React.ReactNode;
  partnerBrand: PartnerBrand;
  partnerStyles: PartnerStyles;
}) {
  return (
    <Suspense fallback={<Fallback />}>
      <QueryProvider>
        <WagmiWrapper partnerBrand={partnerBrand}>
          <QueryClientProvider client={queryClient}>
            <WalletReturnReconnect />
            <RainbowKitProvider
              theme={darkTheme({
                accentColor: partnerStyles.colors.primary,
                accentColorForeground: partnerStyles.colors.primaryForeground,
                borderRadius: "small",
                fontStack: "system",
                overlayBlur: "small",
              })}
            >
              <AppProvider>
                {children}
              </AppProvider>
            </RainbowKitProvider>
          </QueryClientProvider>
        </WagmiWrapper>
      </QueryProvider>
    </Suspense>
  );
}
