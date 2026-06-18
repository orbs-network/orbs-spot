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
  parsedInputAmount = ""
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
        dexMinAmountOut: "-1",
        slippage: slippage,
        signal,
        account: account,
      });
      return {
        outAmount: quote.outAmount,
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
  const liquidityHubQuote = useQuoteLiquidityHub(
    inputCurrency,
    outputCurrency,
    parsedInputAmount
  );

  return useMemo(
    () => ({
      isLoading: liquidityHubQuote.isLoading,
      refetch: liquidityHubQuote.refetch,
      data: liquidityHubQuote.data,
    }),
    [liquidityHubQuote.data, liquidityHubQuote.isLoading, liquidityHubQuote.refetch]
  );
};
