"use client";
import React, { Suspense, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { darkTheme, RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { Spinner } from "@/components/ui/spinner";
import dynamic from "next/dynamic";
import { useConnection, useReconnect, WagmiProvider } from "wagmi";
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

const WalletReturnReconnect = () => {
  const { isConnected, isConnecting, isReconnecting } = useConnection();
  const { mutate: reconnect } = useReconnect();

  useEffect(() => {
    let lastReconnectAt = 0;

    const reconnectIfNeeded = () => {
      if (document.visibilityState !== "visible") {
        return;
      }

      if (isConnected || isConnecting || isReconnecting) {
        return;
      }

      const now = Date.now();
      if (now - lastReconnectAt < 1_500) {
        return;
      }

      lastReconnectAt = now;
      reconnect();
    };

    window.addEventListener("focus", reconnectIfNeeded);
    window.addEventListener("pageshow", reconnectIfNeeded);
    document.addEventListener("visibilitychange", reconnectIfNeeded);

    return () => {
      window.removeEventListener("focus", reconnectIfNeeded);
      window.removeEventListener("pageshow", reconnectIfNeeded);
      document.removeEventListener("visibilitychange", reconnectIfNeeded);
    };
  }, [isConnected, isConnecting, isReconnecting, reconnect]);

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
