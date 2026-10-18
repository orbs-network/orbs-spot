"use client";

import type { Quote } from "@orbs-network/liquidity-hub-sdk";
import { useMemo } from "react";
import { useConnection } from "wagmi";
import { useDerivedSwap } from "@/lib/hooks/use-derived-swap";
import { useSettings } from "@/lib/hooks/use-settings";
import { getActiveLiquidityHubPartnerId } from "@/lib/partners/liquidity-hub";
import { getWrappedNativeCurrency, isNativeAddress } from "@/lib/utils";
import type { JsonContainer } from "./json-inspector";

export function useQuoteInspectionData() {
  const { address: account, chainId } = useConnection();
  const { slippage } = useSettings();
  const { inputCurrency, isLoadingTrade, outputCurrency, parsedInputAmount, trade } = useDerivedSwap();
  const quote = trade?.originalQuote as Quote | undefined;
  const liveQuote = quote && !quote.error ? quote : undefined;
  const partner = getActiveLiquidityHubPartnerId();
  const inputIsNative = isNativeAddress(inputCurrency?.address);
  const requestData = useMemo<JsonContainer>(() => ({
    partner,
    chainId: chainId ?? 1,
    inputIsNative,
    quoteArgs: {
      fromToken: (inputIsNative ? getWrappedNativeCurrency(chainId)?.address : inputCurrency?.address) ?? "<wrapped-input-token-address>",
      toToken: outputCurrency?.address ?? "<output-token-address>",
      inAmount: parsedInputAmount || "0",
      dexMinAmountOut: "-1",
      slippage,
      account: account ?? "<connected-wallet-address>",
    },
  }), [account, chainId, inputCurrency?.address, inputIsNative, outputCurrency?.address, parsedInputAmount, partner, slippage]);
  const responseNotice = liveQuote ? undefined : isLoadingTrade ? "Loading quote response…"
    : parsedInputAmount && parsedInputAmount !== "0" ? "Quote response is not available yet." : "Enter an amount to see quote response.";
  return { requestData, liveQuote, responseNotice, isLoadingQuote: isLoadingTrade && !liveQuote };
}
