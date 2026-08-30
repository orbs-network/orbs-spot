import { useQuery } from "@tanstack/react-query";
import { useLiquidityHub } from "./liquidity-hub";
import { BestTradeQuote, Currency } from "../types";
import { useSettings } from "./use-settings";
import BN from "bignumber.js";
import {
  getWrappedNativeCurrency,
  isNativeAddress,
} from "../utils";
import { useConnection } from "wagmi";
import { useSwapStore } from "./store";
import { useMemo } from "react";
import { useIsSwapTab } from "./use-form-tab";

const stopQuoteLiquidityHub = (_error?: string) => {
  if (!_error) return false;
  const error = _error.toLowerCase();
  if (error.includes("not supported")) {
    return true;
  }
  if (error.includes("ldv")) {
    return true;
  }
  return false;
};

const useQuoteLiquidityHub = (
  inputCurrency?: Currency,
  outputCurrency?: Currency,
  parsedInputAmount = "",
  enabled = true
) => {
  const liquidityHub = useLiquidityHub();
  const { slippage } = useSettings();
  const pauseQuote = useSwapStore((state) => state.pauseQuote);
  const { chainId, address: account } = useConnection();
  const inputCurrencyAddress = inputCurrency?.address ?? "";
  const outputCurrencyAddress = outputCurrency?.address ?? "";
  return useQuery<BestTradeQuote>({
    queryKey: [
      "quote-liquidity-hub",
      chainId,
      account,
      inputCurrencyAddress,
      outputCurrencyAddress,
      parsedInputAmount,
      slippage,
    ],
    queryFn: async ({ signal }) => {
      const quote = await liquidityHub.getQuote({
        fromToken: isNativeAddress(inputCurrencyAddress)
          ? getWrappedNativeCurrency(chainId!)?.address ?? ""
          : inputCurrencyAddress!,
        toToken: outputCurrencyAddress!,
        inAmount: parsedInputAmount,
        // No DEX router quote exists in this reference app. Production DEXes
        // should pass their router's slippage-adjusted minimum output here.
        dexMinAmountOut: "-1",
        slippage: slippage,
        signal,
        account: account,
      });
      return {
        outAmount: BN(quote.outAmount)
          .plus(BN(quote.gasAmountOut || "0"))
          .toFixed(0),
        minAmountOut: quote.minAmountOut,
        inToken: inputCurrency!.address,
        outToken: outputCurrency!.address,
        inAmount: quote.inAmount,
        gas: quote.gasAmountOut as string,
        originalQuote: quote,
      };
    },
    refetchInterval: (it) => {
      if (stopQuoteLiquidityHub(it.state.error?.message)) {
        return false;
      }
      return pauseQuote ? false : 10_000;
    },
    retry: (failureCount, error) => {
      if (stopQuoteLiquidityHub(error?.message)) {
        return false;
      }
      return failureCount < 2;
    },
    enabled:
      enabled &&
      !!inputCurrencyAddress &&
      !!outputCurrencyAddress &&
      BN(parsedInputAmount).gt(0) &&
      !!chainId,
  });
};

export const useTrade = (
  inputCurrency?: Currency,
  outputCurrency?: Currency,
  parsedInputAmount = ""
) => {
  const isSwapTab = useIsSwapTab();
  const liquidityHubQuote = useQuoteLiquidityHub(
    inputCurrency,
    outputCurrency,
    parsedInputAmount,
    isSwapTab
  );

  return useMemo(
    () => ({
      isLoading: isSwapTab ? liquidityHubQuote.isLoading : false,
      refetch: liquidityHubQuote.refetch,
      data: isSwapTab ? liquidityHubQuote.data : undefined,
      usesLiquidityHubQuote: isSwapTab,
    }),
    [
      isSwapTab,
      liquidityHubQuote.data,
      liquidityHubQuote.isLoading,
      liquidityHubQuote.refetch,
    ]
  );
};
