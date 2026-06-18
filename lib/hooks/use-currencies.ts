import { useMemo } from "react";
import { filterCurrencies, getTokenKey, isNativeAddress, sortTokens } from "../utils";
import { erc20Abi, getAddress, isAddress } from "viem";
import { useConnection, useReadContracts } from "wagmi";
import { useBalances } from "./use-balances";
import { useUSDPrices } from "./use-usd-price";
import { Currency } from "../types";
import { useCurrenciesQuery } from "./use-currencies-query";
import { DEFAULT_CHAIN_ID } from "../consts";

const useExternalCurrency = (address?: `0x${string}`) => {
  const { chainId } = useConnection();
  const targetChainId = chainId ?? DEFAULT_CHAIN_ID;
  const enabled = Boolean(address);
  const { data: externalCurrency } = useReadContracts({
    allowFailure: false,
    contracts: [
      {
        address,
        chainId: targetChainId,
        abi: erc20Abi,
        functionName: "decimals",
      },
      {
        address,
        chainId: targetChainId,
        abi: erc20Abi,
        functionName: "name",
      },
      {
        address,
        chainId: targetChainId,
        abi: erc20Abi,
        functionName: "symbol",
      },
    ],
    query: {
      enabled,
    },
  });

  return useMemo((): Currency | undefined => {
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
};

const useAllCurrencies = () => {
  const { chainId } = useConnection();
  const { data: currencies, isLoading } = useCurrenciesQuery();

  const { data: balances } = useBalances();

  const tokensWithBalance = useMemo(
    () => {
      if (!currencies?.length || !balances) return [];

      return currencies
        .filter((it) => {
          const raw = balances[getTokenKey(it.address)]?.toString();
          return raw !== undefined && raw !== "" && raw !== "0";
        })
        .map((it) => it.address);
    },
    [currencies, balances]
  );

  const { data: usdPrices } = useUSDPrices(tokensWithBalance);

  const result = useMemo(() => {
    if (!currencies) return [];
    if (!balances || tokensWithBalance.length === 0) return currencies;

    return sortTokens(currencies, usdPrices, balances, chainId);
  }, [currencies, balances, usdPrices, chainId, tokensWithBalance.length]);

  return useMemo(
    () => ({
      currencies: result,
      isLoading,
      balances,
      usdPrices,
    }),
    [balances, isLoading, result, usdPrices]
  );
};

export const useCurrencies = (query?: string) => {
  const { currencies, isLoading, balances, usdPrices } = useAllCurrencies();
  const internalCurrencies = useMemo(() => {
    if (!query) return currencies;
    return filterCurrencies(currencies, [query]);
  }, [currencies, query]);

  const allowExternal =
    query && !internalCurrencies?.length && isAddress(query);

  const externalCurrency = useExternalCurrency(
    allowExternal ? query : undefined
  );

  const result = useMemo(() => {
    if (externalCurrency) {
      return [externalCurrency];
    }
    return internalCurrencies;
  }, [externalCurrency, internalCurrencies]);

  return useMemo(
    () => ({
      currencies: result,
      isLoading,
      balances,
      usdPrices,
    }),
    [balances, isLoading, result, usdPrices]
  );
};

export const useCurrency = (address?: string) => {
  const tokenKey = getTokenKey(address);
  const { data: currencies } = useCurrenciesQuery();

  const internalCurrency = useMemo(() => {
    return currencies?.find((currency) => getTokenKey(currency.address) === tokenKey);
  }, [currencies, tokenKey]);

  const allowExternal =
    address &&
    !internalCurrency &&
    !isNativeAddress(address) &&
    isAddress(address);

  const externalCurrency = useExternalCurrency(
    allowExternal ? address : undefined
  );

  return useMemo(() => {
    return internalCurrency ?? externalCurrency;
  }, [externalCurrency, internalCurrency]);
};
