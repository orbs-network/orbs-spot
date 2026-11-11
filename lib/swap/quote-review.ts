import type { SwapQuote } from "@orbs-network/spot-ui";
import type { BestTradeQuote } from "../types";

export const MAX_QUOTE_AGE_MILLIS = 20_000;

/** Keep host display amounts and the exact SDK quote together, including native input identity. */
export function toBestTradeQuote(quote: SwapQuote, sourceToken = quote.request.inToken): BestTradeQuote {
  return {
    inToken: sourceToken,
    outToken: quote.request.outToken,
    inAmount: quote.request.inAmount,
    outAmount: quote.netAmountOut,
    minAmountOut: quote.minimumAmountOut,
    slippage: quote.request.slippage,
    originalQuote: quote,
  };
}

/** Either a lower output or a lower protected minimum requires another review. */
export function isQuoteWorse(reviewed: BestTradeQuote, next: BestTradeQuote): boolean {
  return BigInt(next.minAmountOut) < BigInt(reviewed.minAmountOut)
    || BigInt(next.outAmount) < BigInt(reviewed.outAmount);
}
