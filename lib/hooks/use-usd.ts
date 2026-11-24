"use client";

import { useQuery } from "@tanstack/react-query";
import { spotTokenUsdQueryOptions } from "@/lib/spot/prices";
import { getWrappedNativeCurrency, isNativeAddress } from "@/lib/utils";
import type { Currency } from "@/lib/types";
import { getUsdValue } from "@/lib/swap/quote-valuation";
import { useDataChainId } from "./use-data-chain-id";

/** USD per whole token and the value of a UI amount, independent of a quote. */
export function useUsd(currency?: Currency, amount?: string) {
  const chainId = useDataChainId();
  const tokenAddress = isNativeAddress(currency?.address)
    ? getWrappedNativeCurrency(chainId)?.address ?? ""
    : currency?.address ?? "";
  const query = useQuery({
    ...spotTokenUsdQueryOptions(chainId, tokenAddress),
    enabled: Boolean(tokenAddress),
  });
  return {
    price: query.data,
    value: getUsdValue(amount, query.data),
    isLoading: Boolean(tokenAddress) && query.isLoading,
    error: query.error,
  };
}
