import { useSwapStore } from "./store";
import { useSwapParams } from "./use-swap-params";
import { useCurrency } from "./use-currencies";
import { useToAmountUI, useToAmountWei } from "./common";
import { useTrade } from "./use-trade";
import { useMemo } from "react";
import { displayTokenAmount } from "../token-display";
import BN from "bignumber.js";
import { useNativeConversion } from "./use-native-conversion";

export const useDerivedSwap = () => {
  const {
    inputCurrency: inputCurrencyAddress,
    outputCurrency: outputCurrencyAddress,
  } = useSwapParams();
  const inputAmount = useSwapStore((state) => state.inputAmount);
  const nativeConversion = useNativeConversion();
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
    usesSpotQuote,
  } = useTrade(inputCurrency, outputCurrency, parsedInputAmount);

  const quotedOutputAmount = displayTokenAmount(useToAmountUI(
    outputCurrency?.decimals,
    trade?.outAmount
  ), outputCurrency?.symbol, outputCurrency?.decimals);
  const outputAmount = nativeConversion && !usesSpotQuote ? inputAmount : quotedOutputAmount;

  const noLiquidity = useMemo(
    () =>
      usesSpotQuote &&
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
      usesSpotQuote,
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
      usesSpotQuote,
      nativeConversion,
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
      usesSpotQuote,
      nativeConversion,
    ]
  );
};
