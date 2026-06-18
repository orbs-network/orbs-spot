import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useConnection } from "wagmi";
import { DEFAULT_CHAIN_ID } from "../consts";
import { getCurrencies } from "../get-currencies";
import { dedupeCurrenciesByAddress, getTokenKey } from "../utils";
import { useUserStore } from "./store";

const CURRENCIES_STALE_TIME = 1000 * 60 * 60 * 24;

const getCustomCurrenciesKey = (customCurrenciesList: { address: string }[]) =>
  customCurrenciesList
    .map((currency) => getTokenKey(currency.address))
    .sort()
    .join(",");

const getCurrenciesQueryKey = (chainId: number, customCurrenciesKey: string) =>
  ["currencies", chainId, customCurrenciesKey] as const;

const fetchCurrencies = async (
  chainId: number,
  customCurrenciesList: Parameters<typeof dedupeCurrenciesByAddress>[0],
  signal?: AbortSignal
) => {
  try {
    const currencies = await getCurrencies(chainId, signal);
    return dedupeCurrenciesByAddress([...currencies, ...customCurrenciesList]);
  } catch (error) {
    console.error("Error fetching currencies:", error);
    throw error;
  }
};

const useCurrenciesQueryMeta = () => {
  const { chainId = DEFAULT_CHAIN_ID } = useConnection();
  const customCurrencies = useUserStore((state) => state.customCurrencies);
  const customCurrenciesList = useMemo(
    () => customCurrencies[chainId] ?? [],
    [chainId, customCurrencies]
  );
  const customCurrenciesKey = useMemo(
    () => getCustomCurrenciesKey(customCurrenciesList),
    [customCurrenciesList]
  );
  const queryKey = useMemo(
    () => getCurrenciesQueryKey(chainId, customCurrenciesKey),
    [chainId, customCurrenciesKey]
  );

  return useMemo(
    () => ({ chainId, customCurrenciesList, queryKey }),
    [chainId, customCurrenciesList, queryKey]
  );
};

export function useCurrenciesQuery() {
    const { chainId, customCurrenciesList, queryKey } = useCurrenciesQueryMeta();
  
    return useQuery({
      queryKey,
      queryFn: ({ signal }) => fetchCurrencies(chainId, customCurrenciesList, signal),
      staleTime: CURRENCIES_STALE_TIME,
    });
  }



  
