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
  const { slippage, slippageMode } = useSettings();
  const { partner } = useSpotPartner();
  const { inputCurrency, isLoadingTrade, outputCurrency, amountSide, parsedQuoteAmount, trade,
    quoteSlippage, isLoadingSlippage, slippageTokenAddress, slippageAmountUsd } = useDerivedSwap();
  const liveQuote = trade?.originalQuote;
  const inputIsNative = isNativeAddress(inputCurrency?.address);
  const requestData = useMemo<JsonContainer>(() => ({
    partner,
    chainId,
    inputIsNative,
    slippagePolicy: {
      mode: slippageMode,
      baseline: slippage,
      tokenAddress: slippageTokenAddress,
      tokenDecimals: (amountSide === "output" ? outputCurrency?.decimals : inputCurrency?.decimals) ?? 18,
      rawAmount: parsedQuoteAmount,
      ...(slippageAmountUsd !== undefined ? { amountUsd: slippageAmountUsd } : {}),
      ...(quoteSlippage !== undefined ? { slippagePercent: liveQuote?.request.slippage ?? quoteSlippage } : {}),
    },
    quoteArgs: liveQuote ? {
      inToken: liveQuote.request.inToken,
      outToken: liveQuote.request.outToken,
      ...(amountSide === "output"
        ? { outAmount: liveQuote.requestedOutAmount ?? parsedQuoteAmount }
        : { inAmount: liveQuote.request.inAmount, dexMinAmountOut: liveQuote.request.dexMinAmountOut ?? "-1" }),
      slippage: liveQuote.request.slippage,
      user: liveQuote.request.user,
    } : {
      inToken: (inputIsNative ? getWrappedNativeCurrency(chainId)?.address : inputCurrency?.address) ?? "<wrapped-input-token-address>",
      outToken: outputCurrency?.address ?? "<output-token-address>",
      ...(amountSide === "output"
        ? { outAmount: parsedQuoteAmount || "0" }
        : { inAmount: parsedQuoteAmount || "0", dexMinAmountOut: "-1" }),
      slippage: quoteSlippage ?? slippage,
      user: account ?? QUOTE_PREVIEW_ACCOUNT,
    },
  }), [account, chainId, inputCurrency?.address, inputCurrency?.decimals, inputIsNative, liveQuote, outputCurrency?.address,
    outputCurrency?.decimals, amountSide, parsedQuoteAmount, partner, slippage, slippageMode, quoteSlippage, slippageTokenAddress, slippageAmountUsd]);
  const responseNotice = liveQuote ? undefined : isLoadingSlippage ? "Resolving automatic slippage before requesting a quote…"
    : isLoadingTrade ? "Loading quote response…"
    : parsedQuoteAmount && parsedQuoteAmount !== "0" ? "Quote response is not available yet." : "Enter an amount to see quote response.";
  return { requestData, liveQuote, responseNotice, isLoadingQuote: isLoadingTrade && !liveQuote };
}
