import { useQuery } from "@tanstack/react-query";
import { getUSDPrice, MAX_USD_PRICE_TOKENS } from "../get-usd-price";
import { useConnection } from "wagmi";
import BN from "bignumber.js";
import { useMemo } from "react";
import { useFormatNumber } from "./common";
import { getTokenKey, uniqueTokenAddresses } from "../utils";

export const useUSDPrices = (tokens?: string[], disabled?: boolean) => {
  const { chainId } = useConnection();
  const normalizedTokens = useMemo(
    () => uniqueTokenAddresses(tokens ?? []).slice(0, MAX_USD_PRICE_TOKENS),
    [tokens]
  );

  return useQuery({
    queryKey: ["usd-price", normalizedTokens.join(","), chainId],
    queryFn: async ({ signal }) => {
      const response = await getUSDPrice(normalizedTokens, chainId!, signal);
      return response;
    },
    enabled: normalizedTokens.length > 0 && !!chainId && !disabled,
    staleTime: Infinity,
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
    return BN(usdPrices?.[tokenKey] ?? usdPrices?.[token ?? ""] ?? 0)
      .multipliedBy(amount ?? 0)
      .decimalPlaces(6)
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
