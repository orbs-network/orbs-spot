"use client";
import React, { Suspense, useEffect, useMemo, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { darkTheme, lightTheme, RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { useTheme } from "./theme";
import { getThemeStyles } from "./partners/themes";
import { Spinner } from "@/components/ui/spinner";
import dynamic from "next/dynamic";
import { WagmiProvider } from "wagmi";
import type { PartnerBrand, PartnerStyles } from "./partners/types";
import { QueryProvider } from "./query-provider";
import { useWagmiConfig } from "./wagmi-config";
import { WalletReturnReconnect } from "@/features/wallet-connection/return-reconnect";
import { WalletConnectionProvider } from "@/features/wallet-connection/provider";
import { getOrbsWalletColors } from "@/features/wallet-connection/orbs-theme";
import { IS_ORBS } from "./partners/client";

const AppProvider = dynamic(
  () => import("./context").then((mod) => mod.AppProvider),
  { ssr: false },
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
  const [queryClient] = useState(createQueryClient);
  const { theme } = useTheme();
  const walletTheme = useMemo(() => {
    const themeStyles = getThemeStyles(partnerStyles, theme);
    const walletTheme = (theme === "dark" ? darkTheme : lightTheme)({
      accentColor: themeStyles.colors.primary,
      accentColorForeground: themeStyles.colors.primaryForeground,
      borderRadius: partnerStyles.radius === "0rem" ? "none" : "small",
      fontStack: "system",
      overlayBlur: "small",
    });
    if (partnerStyles.radius === "0rem") {
      walletTheme.fonts.body = themeStyles.fontFamily;
      walletTheme.colors.modalBackground = themeStyles.formContainerBackground ?? themeStyles.colors.card;
      walletTheme.colors.modalBorder = themeStyles.colors.border;
      walletTheme.colors.modalText = themeStyles.colors.foreground;
      walletTheme.colors.modalTextSecondary = themeStyles.colors.mutedForeground;
    }
    if (IS_ORBS) {
      walletTheme.colors = getOrbsWalletColors(themeStyles);
      walletTheme.shadows = {
        connectButton: "none", dialog: "none", profileDetailsAction: "none",
        selectedOption: "none", selectedWallet: "none", walletLogo: "none",
      };
    }
    return walletTheme;
  }, [partnerStyles, theme]);
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
            <RainbowKitProvider
              theme={walletTheme}
              modalSize={partnerStyles.radius === "0rem" ? "compact" : "wide"}
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
