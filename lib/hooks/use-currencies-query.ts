import { queryOptions, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { DEFAULT_CHAIN_ID } from "../consts";
import { getCurrencies } from "../get-currencies";
import type { Currency } from "../types";
import { dedupeCurrenciesByAddress } from "../utils";
import { useUserStore } from "./store";
import { useDataChainId } from "./use-data-chain-id";

const CURRENCIES_STALE_TIME = 1000 * 60 * 60 * 24;
const EMPTY_CURRENCIES: Currency[] = [];

export function currenciesQueryOptions(chainId: number) {
  return queryOptions({
    queryKey: ["currencies", chainId],
    queryFn: ({ signal }) => getCurrencies(chainId, signal),
    staleTime: CURRENCIES_STALE_TIME,
    gcTime: 30 * 60_000,
  });
}

export function useCurrenciesQuery(requestedChainId?: number) {
  const connectedChainId = useDataChainId();
  const chainId = requestedChainId ?? connectedChainId;
  const queryChainId = chainId ?? DEFAULT_CHAIN_ID;
  const customCurrencies = useUserStore(
    (state) => state.customCurrencies[queryChainId] ?? EMPTY_CURRENCIES,
  );
  const query = useQuery(currenciesQueryOptions(queryChainId));
  // Imported tokens are local state. Adding one must not refetch the remote list
  // or hide an existing list while a new cache entry loads.
  const data = useMemo(() => query.data
    ? customCurrencies.length
      ? dedupeCurrenciesByAddress([...query.data, ...customCurrencies])
      : query.data
    : undefined, [query.data, customCurrencies]);
  return { ...query, data };
}
