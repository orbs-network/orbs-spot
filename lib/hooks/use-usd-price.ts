import { useQuery } from "@tanstack/react-query";
import { getUSDPrice, MAX_USD_PRICE_TOKENS } from "../get-usd-price";
import BN from "bignumber.js";
import { useMemo } from "react";
import { useFormatNumber } from "./common";
import { getTokenKey, uniqueTokenAddresses } from "../utils";
import { useDataChainId } from "./use-data-chain-id";

export const useUSDPrices = (tokens?: string[], disabled?: boolean) => {
  const chainId = useDataChainId();
  const normalizedTokens = useMemo(
    () => uniqueTokenAddresses(tokens ?? []).sort().slice(0, MAX_USD_PRICE_TOKENS),
    [tokens]
  );

  return useQuery({
    queryKey: ["usd-price", normalizedTokens.join(","), chainId],
    queryFn: ({ signal }) => getUSDPrice(normalizedTokens, chainId!, signal),
    enabled: normalizedTokens.length > 0 && !!chainId && !disabled,
    staleTime: 30_000,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });
};

export const useUSDPrice = ({
  token,
  amount = "1",
  disabled,

}: {
  token?: string;
  amount?: string;
  disabled?: boolean;
}) => {
  const tokenKey = getTokenKey(token);
  const tokens = useMemo(() => (token ? [token] : []), [token]);
  const { data: usdPrices, isLoading, isError } = useUSDPrices(
    tokens,
    disabled || !tokenKey
  );  

  const data = useMemo(() => {
    const price = usdPrices?.[tokenKey] ?? usdPrices?.[token ?? ""];
    if (price === undefined || !Number.isFinite(price) || price <= 0) return undefined;
    return BN(price)
      .multipliedBy(amount ?? 0)
      .toNumber();
  }, [usdPrices, token, tokenKey, amount]);

  const usdFormatted = useFormatNumber({ value: data, decimalScale: 2 });

  return useMemo(
    () => ({
      data,
      formatted: usdFormatted,
      isLoading,
      isError,
    }),
    [data, isError, isLoading, usdFormatted]
  );
};
