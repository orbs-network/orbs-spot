import { useMemo } from "react";
import { filterCurrencies, getTokenKey, isNativeAddress, sortTokens } from "../utils";
import { erc20Abi, getAddress, isAddress } from "viem";
import { useConnection, useReadContracts } from "wagmi";
import { useBalances } from "./use-balances";
import { useUSDPrices } from "./use-usd-price";
import type { Currency } from "../types";
import { useCurrenciesQuery } from "./use-currencies-query";
import { useDataChainId } from "./use-data-chain-id";

const useExternalCurrency = (address?: `0x${string}`, requestedChainId?: number) => {
  const connectedChainId = useDataChainId();
  const chainId = requestedChainId ?? connectedChainId;
  const enabled = Boolean(address && chainId);
  const { data: externalCurrency, isPending } = useReadContracts({
    allowFailure: false,
    contracts: [
      {
        address,
        chainId,
        abi: erc20Abi,
        functionName: "decimals",
      },
      {
        address,
        chainId,
        abi: erc20Abi,
        functionName: "name",
      },
      {
        address,
        chainId,
        abi: erc20Abi,
        functionName: "symbol",
      },
    ],
    query: {
      enabled,
      staleTime: 24 * 60 * 60_000,
      gcTime: 30 * 60_000,
    },
  });

  const currency = useMemo((): Currency | undefined => {
    if (!address || !externalCurrency) return undefined;
    return {
      decimals: externalCurrency[0] ?? 0,
      name: externalCurrency[1] ?? "",
      symbol: externalCurrency[2] ?? "",
      address: getAddress(address),
      logoUrl: "",
      imported: true,
    };
  }, [externalCurrency, address]);
  return { currency, isLoading: enabled && isPending };
};

const useAllCurrencies = () => {
  const { chainId } = useConnection();
  const {
    data: currencies,
    isError,
    isLoading,
    refetch,
  } = useCurrenciesQuery();

  const { data: balances } = useBalances();

  const tokensWithBalance = useMemo(() => {
    if (!currencies?.length || !balances) return [];

    return currencies
      .filter((it) => {
        const raw = balances[getTokenKey(it.address)]?.toString();
        return raw !== undefined && raw !== "" && raw !== "0";
      })
      .map((it) => it.address);
  }, [currencies, balances]);

  const { data: usdPrices } = useUSDPrices(tokensWithBalance);

  const result = useMemo(() => {
    if (!currencies) return [];
    if (!balances || tokensWithBalance.length === 0) return currencies;

    return sortTokens(currencies, usdPrices, balances, chainId);
  }, [currencies, balances, usdPrices, chainId, tokensWithBalance.length]);

  return {
    balances,
    currencies: result,
    isError,
    isLoading,
    refetch,
    usdPrices,
  };
};

export const useCurrencies = (query?: string) => {
  const { balances, currencies, isError, isLoading, refetch, usdPrices } =
    useAllCurrencies();
  const internalCurrencies = useMemo(() => {
    if (!query) return currencies;
    return filterCurrencies(currencies, [query]);
  }, [currencies, query]);

  const allowExternal =
    query && !isLoading && !internalCurrencies?.length && isAddress(query);

  const { currency: externalCurrency, isLoading: isLoadingExternal } = useExternalCurrency(
    allowExternal ? query : undefined
  );

  const result = useMemo(
    () => externalCurrency ? [externalCurrency] : internalCurrencies,
    [externalCurrency, internalCurrencies],
  );

  return {
    balances,
    currencies: result,
    isError,
    isLoading: isLoading || isLoadingExternal,
    refetch,
    usdPrices,
  };
};

export const useCurrencyMetadata = (address?: string, chainId?: number) => {
  const tokenKey = getTokenKey(address);
  const { data: currencies, isLoading } = useCurrenciesQuery(chainId);

  const internalCurrency = useMemo(() => {
    return currencies?.find((currency) => getTokenKey(currency.address) === tokenKey);
  }, [currencies, tokenKey]);

  const allowExternal =
    address &&
    !internalCurrency &&
    !isLoading &&
    !isNativeAddress(address) &&
    isAddress(address);

  const externalCurrency = useExternalCurrency(
    allowExternal ? address : undefined, chainId
  );

  const currency = internalCurrency ?? externalCurrency.currency;
  return { currency, isLoading: !currency && (isLoading || externalCurrency.isLoading) };
};

export const useCurrency = (address?: string, chainId?: number) =>
  useCurrencyMetadata(address, chainId).currency;
