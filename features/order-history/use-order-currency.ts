"use client";

import { useMemo } from "react";
import { getAddress, isAddress, zeroAddress } from "viem";
import { useQuery } from "@tanstack/react-query";
import { SUPPORTED_CHAINS } from "@/lib/consts";
import { isNativeAddress } from "@/lib/utils";
import { orderTokenCurrency, orderTokenQueryOptions, type OrderToken } from "@/lib/spot/order-tokens";

/** Prefer attached order metadata; standalone token views share the same cache. */
export function useOrderCurrency(address?: string, chainId?: number, supplied?: OrderToken) {
  const tokenAddress = address && isAddress(address) ? getAddress(address) : undefined;
  const chain = SUPPORTED_CHAINS.find(chain => chain.id === chainId);
  const native = isNativeAddress(tokenAddress);
  const enabled = Boolean(tokenAddress && chain && !native && !supplied);
  const query = useQuery({
    ...orderTokenQueryOptions({ chainId: chainId ?? 0, address: tokenAddress ?? zeroAddress }),
    enabled,
  });
  const currency = useMemo(() => {
    if (!tokenAddress || !chain) return undefined;
    const metadata = supplied ?? (native ? { chainId: chain.id, address: tokenAddress, ...chain.nativeCurrency } : query.data);
    return orderTokenCurrency(metadata);
  }, [tokenAddress, chain, native, supplied, query.data]);
  return { currency, isLoading: enabled && query.isPending };
}
