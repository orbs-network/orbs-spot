"use client";

import { useMemo } from "react";
import { useConnection } from "wagmi";
import { useDerivedSwap } from "@/lib/hooks/use-derived-swap";
import { useDataChainId } from "@/lib/hooks/use-data-chain-id";
import { useSettings } from "@/lib/hooks/use-settings";
import { useSpotPartner } from "@/lib/hooks/use-spot-partner";
import { QUOTE_PREVIEW_ACCOUNT } from "@/lib/swap/quote-preview";
import { getWrappedNativeCurrency, isNativeAddress } from "@/lib/utils";
import type { JsonContainer } from "./json-inspector";

export function useQuoteInspectionData() {
  const { address: account } = useConnection();
  const chainId = useDataChainId();
  const { slippage } = useSettings();
  const { partner } = useSpotPartner();
  const { inputCurrency, isLoadingTrade, outputCurrency, parsedInputAmount, trade } = useDerivedSwap();
  const liveQuote = trade?.originalQuote;
  const inputIsNative = isNativeAddress(inputCurrency?.address);
  const requestData = useMemo<JsonContainer>(() => ({
    partner,
    chainId,
    inputIsNative,
    quoteArgs: liveQuote ? {
      inToken: liveQuote.request.inToken,
      outToken: liveQuote.request.outToken,
      inAmount: liveQuote.request.inAmount,
      dexMinAmountOut: liveQuote.request.dexMinAmountOut ?? "-1",
      slippage: liveQuote.request.slippage,
      user: liveQuote.request.user,
    } : {
      inToken: (inputIsNative ? getWrappedNativeCurrency(chainId)?.address : inputCurrency?.address) ?? "<wrapped-input-token-address>",
      outToken: outputCurrency?.address ?? "<output-token-address>",
      inAmount: parsedInputAmount || "0",
      dexMinAmountOut: "-1",
      slippage,
      user: account ?? QUOTE_PREVIEW_ACCOUNT,
    },
  }), [account, chainId, inputCurrency?.address, inputIsNative, liveQuote, outputCurrency?.address, parsedInputAmount, partner, slippage]);
  const responseNotice = liveQuote ? undefined : isLoadingTrade ? "Loading quote response…"
    : parsedInputAmount && parsedInputAmount !== "0" ? "Quote response is not available yet." : "Enter an amount to see quote response.";
  return { requestData, liveQuote, responseNotice, isLoadingQuote: isLoadingTrade && !liveQuote };
}
