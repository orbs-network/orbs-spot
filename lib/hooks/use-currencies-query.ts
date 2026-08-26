import { skipToken, useQuery } from "@tanstack/react-query";

import { DEFAULT_CHAIN_ID } from "../consts";
import { getCurrencies } from "../get-currencies";
import type { Currency } from "../types";
import { dedupeCurrenciesByAddress, getTokenKey } from "../utils";
import { useUserStore } from "./store";
import { useDataChainId } from "./use-data-chain-id";

const CURRENCIES_STALE_TIME = 1000 * 60 * 60 * 24;
const EMPTY_CURRENCIES: Currency[] = [];

const currencyKeys = {
  all: ["currencies"] as const,
  list: (chainId: number, customCurrenciesKey: string) =>
    [...currencyKeys.all, chainId, customCurrenciesKey] as const,
};

function getCustomCurrenciesKey(
  customCurrencies: readonly Pick<Currency, "address">[],
): string {
  return customCurrencies
    .map((currency) => getTokenKey(currency.address))
    .sort()
    .join(",");
}

async function fetchCurrencies({
  chainId,
  customCurrencies,
  signal,
}: {
  chainId: number;
  customCurrencies: Currency[];
  signal: AbortSignal;
}): Promise<Currency[]> {
  const currencies = await getCurrencies(chainId, signal);
  return dedupeCurrenciesByAddress([...currencies, ...customCurrencies]);
}

export function useCurrenciesQuery() {
  const chainId = useDataChainId();
  const queryChainId = chainId ?? DEFAULT_CHAIN_ID;
  const customCurrencies = useUserStore(
    (state) => state.customCurrencies[queryChainId] ?? EMPTY_CURRENCIES,
  );
  const customCurrenciesKey = getCustomCurrenciesKey(customCurrencies);

  return useQuery({
    queryKey: currencyKeys.list(queryChainId, customCurrenciesKey),
    queryFn: chainId
      ? ({ signal }) => fetchCurrencies({ chainId, customCurrencies, signal })
      : skipToken,
    staleTime: CURRENCIES_STALE_TIME,
  });
}
