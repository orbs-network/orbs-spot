"use client";

import { useMemo } from "react";
import { erc20Abi, getAddress, isAddress } from "viem";
import { useReadContracts } from "wagmi";
import { SUPPORTED_CHAINS } from "@/lib/consts";
import type { Currency } from "@/lib/types";
import { getNativeTokenLogoUrl, isNativeAddress } from "@/lib/utils";

/** History needs metadata for its tokens, never an entire chain's token list. */
export function useOrderCurrency(address?: string, chainId?: number) {
  const tokenAddress = address && isAddress(address)
    ? getAddress(address)
    : undefined;
  const chain = SUPPORTED_CHAINS.find((item) => item.id === chainId);
  const native = isNativeAddress(tokenAddress);
  const enabled = Boolean(tokenAddress && chain && !native);
  // wagmi uses React Query: the normalized address, chain and calls share a
  // cache across rows, pagination and details, including cross-chain history.
  const { data, isPending } = useReadContracts({
    allowFailure: true,
    contracts: [
      { address: tokenAddress, chainId, abi: erc20Abi, functionName: "decimals" },
      { address: tokenAddress, chainId, abi: erc20Abi, functionName: "symbol" },
    ],
    query: {
      enabled,
      staleTime: 24 * 60 * 60_000,
      gcTime: 30 * 60_000,
    },
  });

  const currency = useMemo((): Currency | undefined => {
    if (!tokenAddress || !chain) return undefined;
    if (native) {
      return {
        ...chain.nativeCurrency,
        address: tokenAddress,
        logoUrl: getNativeTokenLogoUrl(chain.id),
      };
    }
    const decimals = data?.[0].result;
    // Never guess decimals: an unavailable value must not misrepresent amounts.
    if (typeof decimals !== "number") return undefined;
    const symbol = data?.[1].result ?? "";
    return { address: tokenAddress, decimals, symbol, name: symbol, logoUrl: "" };
  }, [tokenAddress, chain, native, data]);

  return { currency, isLoading: enabled && isPending };
}
