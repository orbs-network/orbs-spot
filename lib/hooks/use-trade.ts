import { QuoteError } from "@orbs-network/spot-ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Currency } from "../types";
import { useSettings } from "./use-settings";
import BN from "bignumber.js";
import { getWrappedNativeCurrency, isNativeAddress } from "../utils";
import { useDataChainId } from "./use-data-chain-id";
import { QUOTE_PREVIEW_ACCOUNT } from "@/lib/swap/quote-preview";
import { matchesSpotSwapQuoteAmount, spotSwapQuoteQueryOptions, type SwapAmountSide } from "@/lib/swap/quotes";
import { useConnection } from "wagmi";
import { useSwapStore } from "./store";
import { useCallback, useMemo } from "react";
import { useSpotSwapClient } from "./use-spot-swap-client";
import { getNativeConversion } from "../native-conversion";
import { spotSwapSlippageQueryOptions } from "../swap/slippage";
import { DEFAULT_SLIPPAGE } from "../consts";

export const useTrade = (
  inputCurrency?: Currency,
  outputCurrency?: Currency,
  parsedAmount = "",
  amountSide: SwapAmountSide = "input",
) => {
  const chainId = useDataChainId();
  const { address } = useConnection();
  const { slippage, slippageMode } = useSettings();
  const queryClient = useQueryClient();
  const pauseQuote = useSwapStore(state => state.pauseQuote);
  const wrappedNative = getWrappedNativeCurrency(chainId)?.address;
  // Native/wrapped pairs show the direct conversion form on every tab.
  const usesSpotQuote = !getNativeConversion(
    inputCurrency?.address, outputCurrency?.address, wrappedNative,
  );
  const hasQuoteAmount = usesSpotQuote && Boolean(inputCurrency && outputCurrency) && BN(parsedAmount).gt(0);
  const quoteEnabled = hasQuoteAmount && !pauseQuote;
  const client = useSpotSwapClient(quoteEnabled);
  const automaticSlippage = slippageMode === "auto";
  const inputPriceToken = isNativeAddress(inputCurrency?.address)
    ? wrappedNative ?? "" : inputCurrency?.address ?? "";
  const outputPriceToken = isNativeAddress(outputCurrency?.address)
    ? wrappedNative ?? "" : outputCurrency?.address ?? "";
  const amountCurrency = amountSide === "output" ? outputCurrency : inputCurrency;
  const slippageTokenAddress = amountSide === "output" ? outputPriceToken : inputPriceToken;
  const slippageQuery = useQuery({
    ...spotSwapSlippageQueryOptions(queryClient, client.data, slippageTokenAddress,
      amountCurrency?.decimals, parsedAmount, slippage, amountSide),
    enabled: quoteEnabled && Boolean(client.data) && automaticSlippage,
    refetchInterval: state => {
      if (!quoteEnabled || !automaticSlippage || !state.state.data) return false;
      const options = spotSwapQuoteQueryOptions(client.data, address ?? QUOTE_PREVIEW_ACCOUNT,
        inputCurrency, outputCurrency, parsedAmount, state.state.data.slippagePercent, wrappedNative, amountSide);
      const lastQuote = queryClient.getQueryState([...options.queryKey, state.state.dataUpdatedAt]);
      return lastQuote?.error instanceof QuoteError && !lastQuote.error.retryable ? false : 10_000;
    },
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: quoteEnabled && automaticSlippage,
    refetchOnReconnect: quoteEnabled && automaticSlippage,
  });
  const slippageError = automaticSlippage ? slippageQuery.error : null;
  const quoteSlippage = automaticSlippage
    ? hasQuoteAmount ? slippageQuery.data?.slippagePercent : slippage || DEFAULT_SLIPPAGE
    : slippage;
  const isResolvingSlippage = automaticSlippage && quoteEnabled && !client.error
    && (client.isLoading || slippageQuery.isFetching);
  const quoteOptions = spotSwapQuoteQueryOptions(client.data, address ?? QUOTE_PREVIEW_ACCOUNT,
    inputCurrency, outputCurrency, parsedAmount, quoteSlippage ?? slippage, wrappedNative, amountSide);
  const query = useQuery({
    ...quoteOptions,
    // Every automatic preview refresh prices first, then quotes once using that policy.
    queryKey: automaticSlippage ? [...quoteOptions.queryKey, slippageQuery.dataUpdatedAt] : quoteOptions.queryKey,
    enabled: quoteEnabled && Boolean(client.data) && quoteSlippage !== undefined && !slippageError
      && (!automaticSlippage || !slippageQuery.isFetching),
    // Automatic refreshes use a new timestamp key after rechecking slippage.
    // Retain the previous quote only when every actual request field is identical.
    placeholderData: (previous, previousQuery) => {
      if (!automaticSlippage || !previousQuery) return undefined;
      const previousKey = previousQuery.queryKey;
      const currentKey = quoteOptions.queryKey;
      return previousKey.length === currentKey.length + 1
        && currentKey.every((part, index) => part === previousKey[index])
        ? previous : undefined;
    },
    refetchInterval: state => automaticSlippage || pauseQuote || (state.state.error instanceof QuoteError && !state.state.error.retryable) ? false : 10_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: !automaticSlippage && !pauseQuote,
    refetchOnReconnect: !automaticSlippage && !pauseQuote,
  });
  const refetchQuote = query.refetch;
  const refetchClient = client.refetch;
  const refetchSlippage = slippageQuery.refetch;
  const resolvedSlippage = slippageQuery.data;
  const configuredClient = client.data;
  // TanStack's enabled flag does not prevent imperative refetches.
  const refetch = useCallback(() => {
    if (!quoteEnabled || useSwapStore.getState().pauseQuote) return Promise.resolve(undefined);
    if (!configuredClient) return refetchClient().then(() => undefined);
    if (automaticSlippage) return refetchSlippage().then(() => undefined);
    return refetchQuote();
  }, [automaticSlippage, configuredClient, quoteEnabled, refetchClient, refetchQuote, refetchSlippage]);

  const trade = usesSpotQuote && quoteSlippage !== undefined && !slippageError && !query.error
    && matchesSpotSwapQuoteAmount(query.data, parsedAmount, amountSide)
    ? query.data : undefined;
  const isLoadingSlippage = isResolvingSlippage && !trade;
  const slippageAmountUsd = automaticSlippage ? resolvedSlippage?.amountUsd : undefined;

  return useMemo(() => ({
    error: quoteEnabled ? client.error ?? slippageError ?? (quoteSlippage !== undefined ? query.error : null) : null,
    isLoading: quoteEnabled && !trade && (client.isLoading || isLoadingSlippage || query.isLoading),
    refetch,
    data: trade,
    usesSpotQuote,
    quoteSlippage,
    isLoadingSlippage,
    slippageTokenAddress,
    slippageAmountUsd,
  }), [usesSpotQuote, quoteEnabled, client.error, client.isLoading, trade, query.error, query.isLoading, refetch,
    quoteSlippage, isLoadingSlippage, slippageError, slippageTokenAddress, slippageAmountUsd]);
};
