import { useQuery } from "@tanstack/react-query";
import { useConnection } from "wagmi";
import { useMemo } from "react";
import { useFormatNumber, useToAmountUI } from "./common";
import type { Currency } from "../types";
import {
  getDefaultTokensForChain,
  getPopularTokenForChain,
  getTokenKey,
  uniqueTokenAddresses,
} from "../utils";
import { useSwapParams } from "./use-swap-params";
import { useUserStore } from "./store";
import { DEFAULT_CHAIN_ID } from "../consts";
import { zeroAddress } from "viem";
import { useDataChainId } from "./use-data-chain-id";

type BalanceResponse = Record<string, string>;

const MAX_WATCHED_BALANCE_TOKENS = 80;

const postBalances = async ({
  chainId,
  address,
  tokens,
  signal,
}: {
  chainId?: number;
  address?: string;
  tokens: string[];
  signal?: AbortSignal;
}) => {
  const response = await fetch("/api/balances", {
    signal,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chainId, address, tokens }),
  });

  if (!response.ok) {
    throw new Error("Failed to fetch balances");
  }

  return response.json() as Promise<BalanceResponse>;
};

const useWatchedBalanceAddresses = () => {
  const { chainId } = useConnection();
  const dataChainId = useDataChainId();
  const tokenChainId = chainId ?? dataChainId ?? DEFAULT_CHAIN_ID;
  const { inputCurrency, outputCurrency } = useSwapParams();
  const customCurrencies = useUserStore((state) => state.customCurrencies);

  return useMemo(() => {
    const custom =
      customCurrencies[tokenChainId]?.map((currency) => currency.address) ?? [];
    const defaultTokens = getDefaultTokensForChain(tokenChainId);

    return uniqueTokenAddresses([
      zeroAddress,
      defaultTokens.input,
      defaultTokens.output,
      inputCurrency,
      outputCurrency,
      ...getPopularTokenForChain(tokenChainId),
      ...custom,
    ]).slice(0, MAX_WATCHED_BALANCE_TOKENS);
  }, [customCurrencies, inputCurrency, outputCurrency, tokenChainId]);
};

const useBalanceQueryMeta = () => {
  const { chainId, address } = useConnection();
  const watchedAddresses = useWatchedBalanceAddresses();
  const watchedAddressesKey = watchedAddresses.join(",");

  const queryKey = useMemo(
    () => ["balances", chainId, address?.toLowerCase(), watchedAddressesKey],
    [chainId, address, watchedAddressesKey],
  );

  return useMemo(
    () => ({ address, chainId, queryKey, watchedAddresses }),
    [address, chainId, queryKey, watchedAddresses],
  );
};

// Balance reads and post-transaction refreshes use this same query. Calling
// refetch updates every subscribed balance display without a second mutation cache.
export const useBalances = () => {
  const { chainId, address, queryKey, watchedAddresses } =
    useBalanceQueryMeta();

  return useQuery<BalanceResponse>({
    queryKey,
    queryFn: ({ signal }) =>
      postBalances({ chainId, address, tokens: watchedAddresses, signal }),
    enabled: !!chainId && !!address && watchedAddresses.length > 0,
    refetchInterval: 120_000,
    refetchIntervalInBackground: false,
    staleTime: 60_000,
    gcTime: Infinity,
  });
};

export const useBalance = (currency?: Currency) => {
  const { data: balances, isLoading, refetch } = useBalances();
  const watchedAddresses = useWatchedBalanceAddresses();
  const tokenKey = getTokenKey(currency?.address);
  const isWatched = tokenKey ? watchedAddresses.includes(tokenKey) : false;

  const balance = useMemo(() => {
    return balances?.[tokenKey];
  }, [balances, tokenKey]);

  const ui = useToAmountUI(currency?.decimals, balance);

  const formatted = useFormatNumber({ value: ui });

  return useMemo(
    () => ({
      ui,
      wei: balance,
      formatted,
      isLoading: isWatched && isLoading,
      refetch,
    }),
    [balance, formatted, isLoading, isWatched, refetch, ui],
  );
};
