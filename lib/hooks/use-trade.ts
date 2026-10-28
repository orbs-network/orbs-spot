import { QuoteError } from "@orbs-network/spot-ui";
import { useQuery } from "@tanstack/react-query";
import type { Currency } from "../types";
import { useSettings } from "./use-settings";
import BN from "bignumber.js";
import { getWrappedNativeCurrency } from "../utils";
import { useDataChainId } from "./use-data-chain-id";
import { QUOTE_PREVIEW_ACCOUNT } from "@/lib/swap/quote-preview";
import { spotSwapQuoteQueryOptions } from "@/lib/swap/quotes";
import { useConnection } from "wagmi";
import { useSwapStore } from "./store";
import { useCallback, useMemo } from "react";
import { useIsSwapTab } from "./use-form-tab";
import { useSpotSwapClient } from "./use-spot-swap-client";
import { getNativeConversion } from "../native-conversion";

export const useTrade = (
  inputCurrency?: Currency,
  outputCurrency?: Currency,
  parsedInputAmount = "",
) => {
  const isSwapTab = useIsSwapTab();
  const chainId = useDataChainId();
  const { address } = useConnection();
  const { slippage } = useSettings();
  const pauseQuote = useSwapStore(state => state.pauseQuote);
  const wrappedNative = getWrappedNativeCurrency(chainId)?.address;
  // Every advanced order uses the same full-input quote as swaps. Only the
  // swap tab's direct wrap/unwrap operation bypasses market quoting.
  const usesSpotQuote = !isSwapTab || !getNativeConversion(
    inputCurrency?.address, outputCurrency?.address, wrappedNative,
  );
  const quoteEnabled = usesSpotQuote && !pauseQuote && Boolean(inputCurrency && outputCurrency) && BN(parsedInputAmount).gt(0);
  const client = useSpotSwapClient(quoteEnabled);
  const query = useQuery({
    ...spotSwapQuoteQueryOptions(client.data, address ?? QUOTE_PREVIEW_ACCOUNT,
      inputCurrency, outputCurrency, parsedInputAmount, slippage, wrappedNative),
    enabled: quoteEnabled && Boolean(client.data),
    refetchInterval: state => pauseQuote || (state.state.error instanceof QuoteError && !state.state.error.retryable) ? false : 10_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: !pauseQuote,
  });
  const refetchQuote = query.refetch;
  const refetchClient = client.refetch;
  const configuredClient = client.data;
  // TanStack's enabled flag does not prevent imperative refetches.
  const refetch = useCallback(() => {
    if (useSwapStore.getState().pauseQuote) return Promise.resolve(undefined);
    if (!configuredClient) return refetchClient().then(() => undefined);
    return refetchQuote();
  }, [configuredClient, refetchClient, refetchQuote]);

  return useMemo(() => ({
    error: usesSpotQuote ? (quoteEnabled ? client.error : null) ?? query.error : null,
    isLoading: quoteEnabled && (client.isLoading || query.isLoading),
    refetch,
    data: usesSpotQuote ? query.data : undefined,
    usesSpotQuote,
  }), [usesSpotQuote, quoteEnabled, client.error, client.isLoading, query.data, query.error, query.isLoading, refetch]);
};
