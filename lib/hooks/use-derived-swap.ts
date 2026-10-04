import { useSwapStore } from "./store";
import { useSwapParams } from "./use-swap-params";
import { useCurrency } from "./use-currencies";
import { useFormatDecimals, useToAmountUI, useToAmountWei } from "./common";
import { useTrade } from "./use-trade";
import { useMemo } from "react";
import BN from "bignumber.js";

export const useDerivedSwap = () => {
  const {
    inputCurrency: inputCurrencyAddress,
    outputCurrency: outputCurrencyAddress,
  } = useSwapParams();
  const inputAmount = useSwapStore((state) => state.inputAmount);
  const inputCurrency = useCurrency(inputCurrencyAddress ?? undefined);
  const outputCurrency = useCurrency(outputCurrencyAddress ?? undefined);

  const parsedInputAmount = useToAmountWei(
    inputCurrency?.decimals,
    inputAmount
  );

  const {
    data: trade,
    error: quoteError,
    isLoading: isLoadingTrade,
    refetch: refetchTrade,
    usesLiquidityHubQuote,
  } = useTrade(inputCurrency, outputCurrency, parsedInputAmount);

  const outputAmount = useFormatDecimals(useToAmountUI(
    outputCurrency?.decimals,
    trade?.outAmount
  ));

  const noLiquidity = useMemo(
    () =>
      usesLiquidityHubQuote &&
      Boolean(inputCurrency && outputCurrency) &&
      !isLoadingTrade &&
      BN(parsedInputAmount ?? "0").gt(0) &&
      trade !== undefined && BN(trade.outAmount).isZero(),
    [
      inputCurrency,
      isLoadingTrade,
      outputCurrency,
      parsedInputAmount,
      trade,
      usesLiquidityHubQuote,
    ]
  );

  return useMemo(
    () => ({
      inputCurrency,
      outputCurrency,
      inputAmount,
      parsedInputAmount,
      trade,
      isLoadingTrade,
      noLiquidity,
      quoteError,
      refetchTrade,
      outputAmount,
      usesLiquidityHubQuote,
    }),
    [
      inputAmount,
      inputCurrency,
      isLoadingTrade,
      noLiquidity,
      quoteError,
      outputAmount,
      outputCurrency,
      parsedInputAmount,
      refetchTrade,
      trade,
      usesLiquidityHubQuote,
    ]
  );
};
