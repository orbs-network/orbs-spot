import { useSwapStore } from "./store";
import { useSwapParams } from "./use-swap-params";
import { useCurrency } from "./use-currencies";
import { useToAmountWei } from "./common";
import { useTrade } from "./use-trade";
import { useMemo } from "react";
import BN from "bignumber.js";
import { useNativeConversion } from "./use-native-conversion";
import { getQuoteValuation } from "../swap/quote-valuation";
import { useIsSwapTab } from "./use-form-tab";
import { toAmountUI, toAmountWei } from "../utils";

export const useDerivedSwap = () => {
  const {
    inputCurrency: inputCurrencyAddress,
    outputCurrency: outputCurrencyAddress,
  } = useSwapParams();
  const inputDraft = useSwapStore((state) => state.inputAmount);
  const outputDraft = useSwapStore((state) => state.outputAmount);
  const editedSide = useSwapStore((state) => state.amountSide);
  const isSwapTab = useIsSwapTab();
  const nativeConversion = useNativeConversion();
  // Advanced-order forms keep their existing input-amount contract.
  const amountSide = isSwapTab || nativeConversion ? editedSide : "input";
  const inputCurrency = useCurrency(inputCurrencyAddress ?? undefined);
  const outputCurrency = useCurrency(outputCurrencyAddress ?? undefined);

  const typedAmount = amountSide === "output" ? outputDraft : inputDraft;
  const parsedQuoteAmount = useToAmountWei(
    amountSide === "output" ? outputCurrency?.decimals : inputCurrency?.decimals,
    typedAmount
  );

  const {
    data: trade,
    error: quoteError,
    isLoading: isLoadingTrade,
    refetch: refetchTrade,
    usesSpotQuote,
    quoteSlippage,
    isLoadingSlippage,
    slippageTokenAddress,
    slippageAmountUsd,
  } = useTrade(inputCurrency, outputCurrency, parsedQuoteAmount, amountSide);

  const directConversion = nativeConversion && !usesSpotQuote;
  const parsedInputAmount = amountSide === "input" ? parsedQuoteAmount
    : directConversion ? toAmountWei(outputDraft, inputCurrency?.decimals)
    : trade?.inAmount ?? "0";
  const inputAmount = amountSide === "input" ? inputDraft
    : directConversion ? outputDraft
    : trade ? toAmountUI(trade.inAmount, inputCurrency?.decimals) : "";
  const outputAmount = amountSide === "output" ? outputDraft
    : directConversion ? inputDraft
    : trade ? toAmountUI(trade.outAmount, outputCurrency?.decimals) : "";
  const quoteUsd = useMemo(() => getQuoteValuation(
    isLoadingTrade || quoteError ? undefined : trade,
    inputCurrency?.decimals,
    outputCurrency?.decimals,
  ), [isLoadingTrade, quoteError, trade, inputCurrency?.decimals, outputCurrency?.decimals]);

  const noLiquidity = useMemo(
    () =>
      usesSpotQuote &&
      Boolean(inputCurrency && outputCurrency) &&
      !isLoadingTrade &&
      BN(parsedQuoteAmount).gt(0) &&
      trade !== undefined && BN(trade.outAmount).isZero(),
    [
      inputCurrency,
      isLoadingTrade,
      outputCurrency,
      parsedQuoteAmount,
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
      parsedQuoteAmount,
      amountSide,
      trade,
      quoteUsd,
      isLoadingTrade,
      noLiquidity,
      quoteError,
      refetchTrade,
      outputAmount,
      usesSpotQuote,
      quoteSlippage,
      isLoadingSlippage,
      slippageTokenAddress,
      slippageAmountUsd,
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
      parsedQuoteAmount,
      amountSide,
      refetchTrade,
      trade,
      quoteUsd,
      usesSpotQuote,
      quoteSlippage,
      isLoadingSlippage,
      slippageTokenAddress,
      slippageAmountUsd,
      nativeConversion,
    ]
  );
};
