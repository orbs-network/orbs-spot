"use client";
import React, { Suspense, useEffect, useMemo, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { darkTheme, lightTheme, RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { useTheme } from "./theme";
import dynamic from "next/dynamic";
import { WagmiProvider } from "wagmi";
import type { PartnerBrand } from "./partners/types";
import { QueryProvider } from "./query-provider";
import { useWagmiConfig } from "./wagmi-config";
import { WalletReturnReconnect } from "@/features/wallet-connection/return-reconnect";
import { WalletConnectionProvider } from "@/features/wallet-connection/provider";
import { AppLoading } from "@/components/app-loading";
import { PendingSwapMonitor } from "@/features/swap/activity";
import { useIsMobile } from "./hooks/use-is-mobile";

const AppProvider = dynamic(
  () => import("./context").then((mod) => mod.AppProvider),
  { ssr: false, loading: Fallback },
);

const createQueryClient = () => new QueryClient({
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

function Fallback() {
  return <AppLoading />;
}

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
}: {
  children: React.ReactNode;
  partnerBrand: PartnerBrand;
}) {
  const [queryClient] = useState(createQueryClient);
  const { theme } = useTheme();
  const isMobile = useIsMobile("(max-width: 767px)");
  const walletTheme = useMemo(() => (theme === "dark" ? darkTheme : lightTheme)(), [theme]);
  useEffect(() => {
    const background = getComputedStyle(document.documentElement).getPropertyValue("--background").trim();
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", background);
  }, [theme]);
  return (
    <Suspense fallback={<Fallback />}>
      <QueryProvider>
        <WagmiWrapper partnerBrand={partnerBrand}>
          <QueryClientProvider client={queryClient}>
            <WalletReturnReconnect />
            <PendingSwapMonitor />
            <RainbowKitProvider
              theme={walletTheme}
              modalSize={isMobile ? "compact" : "wide"}
            >
              <WalletConnectionProvider>
                <AppProvider>
                  {children}
                </AppProvider>
              </WalletConnectionProvider>
            </RainbowKitProvider>
          </QueryClientProvider>
        </WagmiWrapper>
      </QueryProvider>
    </Suspense>
  );
}
