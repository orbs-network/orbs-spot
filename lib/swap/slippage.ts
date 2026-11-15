import { getSwapSlippage, type SpotClient, type SwapSlippage } from "@orbs-network/spot-ui";
import { queryOptions } from "@tanstack/react-query";
import BN from "bignumber.js";
import { isAddress, maxUint256, zeroAddress } from "viem";
import { DEFAULT_SLIPPAGE } from "../consts";
import type { SwapAmountSide } from "./quotes";

export const SPOT_SWAP_SLIPPAGE_KEY = ["spot-swap-slippage"] as const;
const PRICE_WAIT_MILLIS = 1_500;

/** Resolve automatic tolerance before quoting; the stored percentage remains the baseline. */
export function spotSwapSlippageQueryOptions(
  client: Pick<SpotClient, "partner" | "chainId" | "apiUrl" | "getTokenUsd"> | undefined,
  tokenAddress: string,
  tokenDecimals: number | undefined,
  rawAmount: string,
  baselineSlippage: number,
  amountSide: SwapAmountSide = "input",
) {
  const baseline = baselineSlippage || DEFAULT_SLIPPAGE;
  return queryOptions({
    queryKey: [...SPOT_SWAP_SLIPPAGE_KEY, client?.apiUrl, client?.partner, client?.chainId,
      tokenAddress.toLowerCase(), tokenDecimals, amountSide, rawAmount, baseline],
    queryFn: async ({ signal }): Promise<SwapSlippage> => {
      signal.throwIfAborted();
      if (!client) throw new Error("Spot configuration is not ready. Retry before requesting slippage");
      if (!isAddress(tokenAddress, { strict: false }) || tokenAddress.toLowerCase() === zeroAddress
        || tokenDecimals === undefined || !Number.isInteger(tokenDecimals) || tokenDecimals < 0 || tokenDecimals > 255
        || !/^\d+$/.test(rawAmount) || BigInt(rawAmount) <= BigInt(0) || BigInt(rawAmount) > maxUint256) {
        throw new Error("Select a token and enter a valid amount before requesting slippage");
      }
      // Validate the baseline before starting a price read. Missing prices retain this policy.
      const fallback = getSwapSlippage({ slippage: baseline });
      let unitPriceUsd: string | undefined;
      try {
        unitPriceUsd = await client.getTokenUsd({
          tokenAddress,
          signal: AbortSignal.any([signal, AbortSignal.timeout(PRICE_WAIT_MILLIS)]),
        });
      } catch {
        // Pricing failure or timeout uses the baseline; cancelling this draft still propagates.
        signal.throwIfAborted();
      }
      signal.throwIfAborted();
      if (unitPriceUsd === undefined) return fallback;
      const amountUsd = BN(rawAmount).shiftedBy(-tokenDecimals).times(unitPriceUsd).toFixed();
      return getSwapSlippage({ amountUsd, slippage: baseline });
    },
    staleTime: 10_000,
    retry: false,
  });
}
