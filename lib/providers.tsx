"use client";
import React, { Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { darkTheme, RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { Spinner } from "@/components/ui/spinner";
import dynamic from "next/dynamic";
import { WagmiProvider } from "wagmi";
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
