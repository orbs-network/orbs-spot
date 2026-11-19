import { getTokenUsd } from "@orbs-network/spot-ui";
import { queryOptions } from "@tanstack/react-query";
import { isAddress, zeroAddress } from "viem";

export const SPOT_TOKEN_USD_KEY = ["spot-token-usd"] as const;
const PRICE_WAIT_MILLIS = 1_500;

/** A token selection and every amount draft share the same USD unit-price resource. */
export function spotTokenUsdQueryOptions(chainId: number, tokenAddress: string) {
  return queryOptions({
    queryKey: [...SPOT_TOKEN_USD_KEY, chainId, tokenAddress.toLowerCase()],
    queryFn: async ({ signal }): Promise<string> => {
      signal.throwIfAborted();
      if (!Number.isSafeInteger(chainId) || chainId <= 0
        || !isAddress(tokenAddress, { strict: false }) || tokenAddress.toLowerCase() === zeroAddress) {
        throw new Error("Select a valid token and network before requesting its USD price");
      }
      return getTokenUsd({
        tokenAddress,
        chainId,
        signal: AbortSignal.any([signal, AbortSignal.timeout(PRICE_WAIT_MILLIS)]),
      });
    },
    staleTime: 30_000,
    retry: false,
  });
}
