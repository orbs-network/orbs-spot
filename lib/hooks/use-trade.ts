import { useQuery } from "@tanstack/react-query";
import { useLiquidityHub } from "./liquidity-hub";
import { BestTradeQuote, Currency } from "../types";
import { useSettings } from "./use-settings";
import BN from "bignumber.js";
import {
  getWrappedNativeCurrency,
  isNativeAddress,
} from "../utils";
import { useDataChainId } from "./use-data-chain-id";
import { useDeveloperMode } from "@/lib/hooks/use-developer-mode";
import { DEVELOPER_PREVIEW_ACCOUNT } from "./use-developer-mode";
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
  const { chainId: walletChainId, address } = useConnection();
  const dataChainId = useDataChainId();
  const { isDeveloperMode } = useDeveloperMode();
  const chainId = walletChainId ?? (isDeveloperMode ? dataChainId : undefined);
  const account = address ?? (isDeveloperMode ? DEVELOPER_PREVIEW_ACCOUNT : undefined);
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
      if (!chainId || !account || !inputCurrency || !outputCurrency || !BN(parsedInputAmount).gt(0)) {
        throw new Error("Connect a wallet and enter an amount before requesting a quote");
      }
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
    // Several controls observe this query. Reuse the quote between polling ticks
    // instead of refetching whenever another consumer mounts.
    staleTime: 10_000,
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
      !pauseQuote &&
      !!account &&
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
      error: isSwapTab ? liquidityHubQuote.error : null,
      isLoading: isSwapTab ? liquidityHubQuote.isLoading : false,
      refetch: liquidityHubQuote.refetch,
      data: isSwapTab ? liquidityHubQuote.data : undefined,
      usesLiquidityHubQuote: isSwapTab,
    }),
    [
      isSwapTab,
      liquidityHubQuote.data,
      liquidityHubQuote.error,
      liquidityHubQuote.isLoading,
      liquidityHubQuote.refetch,
    ]
  );
};
