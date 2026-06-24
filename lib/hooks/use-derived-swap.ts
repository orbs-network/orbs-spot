import { useSwapStore } from "./store";
import { useSwapParams } from "./use-swap-params";
import { useCurrency } from "./use-currencies";
import { useToAmountUI, useToAmountWei } from "./common";
import { useTrade } from "./use-trade";
import { useMemo } from "react";
import BN from "bignumber.js";
import { useSelectedFormTab } from "./use-form-tab";
import { FormTab } from "../types";
import { useUSDPrices } from "./use-usd-price";
import { getTokenKey } from "../utils";
import { parseUnits } from "viem";

const getUsdEstimatedOutputAmount = ({
  inputAmount,
  inputTokenUsd,
  outputDecimals,
  outputTokenUsd,
}: {
  inputAmount: string;
  inputTokenUsd: string | number | undefined;
  outputDecimals?: number;
  outputTokenUsd: string | number | undefined;
}) => {
  if (outputDecimals === undefined) return "0";

  const input = BN(inputAmount || 0);
  const inputUsd = BN(inputTokenUsd ?? 0);
  const outputUsd = BN(outputTokenUsd ?? 0);

  if (input.lte(0) || inputUsd.lte(0) || outputUsd.lte(0)) {
    return "0";
  }

  const estimatedOutput = input
    .multipliedBy(inputUsd)
    .div(outputUsd)
    .decimalPlaces(outputDecimals, BN.ROUND_DOWN);

  try {
    return parseUnits(estimatedOutput.toFixed(), outputDecimals).toString();
  } catch {
    return "0";
  }
};

export const useDerivedSwap = () => {
  const { selectedTab } = useSelectedFormTab();
  const shouldFetchQuotes = selectedTab.value === FormTab.SWAP;
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
    isError: isTradeError,
    isLoading: isLoadingTrade,
    isNoRoute,
    liquidityHubQuote,
    paraswapQuote,
    ensureLiquidityHubQuote,
    refetch: refetchTrade,
    refetchLiquidityHubQuote,
    refetchParaswapQuote,
  } = useTrade(inputCurrency, outputCurrency, parsedInputAmount, shouldFetchQuotes);
  const usdTokens = useMemo(
    () =>
      [inputCurrency?.address, outputCurrency?.address].filter(
        Boolean,
      ) as string[],
    [inputCurrency?.address, outputCurrency?.address],
  );
  const usdPrices = useUSDPrices(usdTokens, shouldFetchQuotes);
  const inputUsdTokenPrice = inputCurrency
    ? usdPrices.data?.[getTokenKey(inputCurrency.address)] ??
      usdPrices.data?.[inputCurrency.address]
    : undefined;
  const outputUsdTokenPrice = outputCurrency
    ? usdPrices.data?.[getTokenKey(outputCurrency.address)] ??
      usdPrices.data?.[outputCurrency.address]
    : undefined;
  const usdEstimatedOutputAmount = useMemo(
    () =>
      getUsdEstimatedOutputAmount({
        inputAmount,
        inputTokenUsd: inputUsdTokenPrice,
        outputDecimals: outputCurrency?.decimals,
        outputTokenUsd: outputUsdTokenPrice,
      }),
    [
      inputAmount,
      inputUsdTokenPrice,
      outputCurrency?.decimals,
      outputUsdTokenPrice,
    ],
  );
  const outputRawAmount = shouldFetchQuotes
    ? trade?.outAmount
    : usdEstimatedOutputAmount;

  const outputAmount = useToAmountUI(
    outputCurrency?.decimals,
    outputRawAmount
  );
  const tradeOutAmount = trade?.outAmount;

  const noLiquidity = useMemo(
    () =>
      Boolean(inputCurrency && outputCurrency) &&
      shouldFetchQuotes &&
      !isLoadingTrade &&
      BN(parsedInputAmount ?? "0").gt(0) &&
      (isNoRoute ||
        isTradeError ||
        Boolean(tradeOutAmount && BN(tradeOutAmount).isZero())),
    [
      inputCurrency,
      isTradeError,
      isLoadingTrade,
      isNoRoute,
      outputCurrency,
      parsedInputAmount,
      shouldFetchQuotes,
      tradeOutAmount,
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
      isTradeError,
      isNoRoute,
      liquidityHubQuote,
      noLiquidity,
      outputRawAmount,
      paraswapQuote,
      ensureLiquidityHubQuote,
      refetchTrade,
      refetchLiquidityHubQuote,
      refetchParaswapQuote,
      outputAmount,
    }),
    [
      inputAmount,
      inputCurrency,
      isTradeError,
      isLoadingTrade,
      isNoRoute,
      liquidityHubQuote,
      noLiquidity,
      outputAmount,
      outputCurrency,
      outputRawAmount,
      paraswapQuote,
      parsedInputAmount,
      ensureLiquidityHubQuote,
      refetchLiquidityHubQuote,
      refetchParaswapQuote,
      refetchTrade,
      trade,
    ]
  );
};
