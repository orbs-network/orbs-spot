"use client";

import { useDataChainId } from "@/lib/hooks/use-data-chain-id";
import { useDeveloperMode } from "../developer-tools/use-developer-mode";
import { useBalance } from "@/lib/hooks/use-balances";
import { getWrappedNativeCurrency } from "@/lib/utils";
import { useDerivedSwap } from "@/lib/hooks/use-derived-swap";
import { useSettings } from "@/lib/hooks/use-settings";
import { useUSDPrice } from "@/lib/hooks/use-usd-price";
import { getActiveClientPartnerConfig } from "@/lib/partners/client";
import { getActiveSpotPartner } from "@/lib/partners/spot";
import { Module, SpotProvider } from "@orbs-network/spot-react";
import { useMemo, type ReactNode } from "react";
import { useConnection } from "wagmi";
import {
  useSpotCallbacks,
  useSpotMarketReferencePrice,
  useSpotToken,
  useWalletInteractions,
} from "./hooks";

export function SpotProviderShell({
  children,
  orderModule,
}: {
  children: ReactNode;
  orderModule: Module;
}) {
  const { inputCurrency, outputCurrency, inputAmount } = useDerivedSwap();
  const { chainId, address, isConnected } = useConnection();
  const dataChainId = useDataChainId();
  const { isDeveloperMode } = useDeveloperMode();
  const spotChainId = isConnected ? chainId : isDeveloperMode ? dataChainId : undefined;
  
  const spotAccount = chainId ? address : undefined;
  const walletInteractions = useWalletInteractions();
  const callbacks = useSpotCallbacks();
  const inputBalance = useBalance(inputCurrency).wei;
  const wrappedNativeToken = useSpotToken(getWrappedNativeCurrency(spotChainId));
  const inputUsd = useUSDPrice({ token: inputCurrency?.address });
  const outputUsd = useUSDPrice({ token: outputCurrency?.address });
  const spotSrcToken = useSpotToken(inputCurrency);
  const spotDstToken = useSpotToken(outputCurrency);
  const marketReferencePrice = useSpotMarketReferencePrice();
  const { priceProtection } = useSettings();
  const marketQuote = useMemo(() => ({
    quotedOutputAmountRaw: marketReferencePrice.value,
    isLoading: marketReferencePrice.isLoading,
    noLiquidity: marketReferencePrice.noLiquidity,
  }), [marketReferencePrice]);

  return (
    <SpotProvider
      chainId={spotChainId}
      inputAmountUi={inputAmount}
      wrappedNativeToken={wrappedNativeToken}
      walletInteractions={walletInteractions}
      account={spotAccount}
      partner={getActiveSpotPartner()}
      inputBalanceRaw={inputBalance}
      inputToken={spotSrcToken}
      outputToken={spotDstToken}
      inputTokenUsdPrice={(inputUsd.data ?? 0).toString()}
      outputTokenUsdPrice={(outputUsd.data ?? 0).toString()}
      priceProtectionPercent={priceProtection}
      module={orderModule}
      marketQuote={marketQuote}
      minTradeSizeUsd={5}
      callbacks={callbacks}
      displayFeePercent={0}
    >
      {children}
    </SpotProvider>
  );
}
