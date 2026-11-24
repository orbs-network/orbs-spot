import BN from "bignumber.js";
import type { BestTradeQuote } from "../types";

export interface QuoteValuation {
  inputAmountUsd?: string;
  outputAmountUsd?: string;
  minimumAmountOutUsd?: string;
  inputTokenUsdPrice?: string;
  outputTokenUsdPrice?: string;
}

/** Multiply full-precision token amounts and unit prices without display rounding. */
export function getUsdValue(amount?: string, price?: string): string | undefined {
  if (!amount || !price) return undefined;
  const units = BN(amount);
  const unitPrice = BN(price);
  if (!units.isFinite() || units.lt(0) || !unitPrice.isFinite() || !unitPrice.gt(0)) return undefined;
  return units.times(unitPrice).toFixed();
}

/** Value the quote's raw token amounts with independently fetched token prices. */
export function getQuoteValuation(
  quote?: BestTradeQuote,
  inputDecimals?: number,
  outputDecimals?: number,
  inputTokenUsdPrice?: string,
  outputTokenUsdPrice?: string,
): QuoteValuation {
  const value = (raw: string | undefined, decimals: number | undefined, price?: string) =>
    raw !== undefined && decimals !== undefined ? getUsdValue(BN(raw).shiftedBy(-decimals).toFixed(), price) : undefined;
  return {
    inputAmountUsd: value(quote?.inAmount, inputDecimals, inputTokenUsdPrice),
    outputAmountUsd: value(quote?.outAmount, outputDecimals, outputTokenUsdPrice),
    minimumAmountOutUsd: value(quote?.minAmountOut, outputDecimals, outputTokenUsdPrice),
    inputTokenUsdPrice,
    outputTokenUsdPrice,
  };
}

export function assertMinimumQuoteValue(quote: BestTradeQuote, minimumUsd: number, inputDecimals: number, inputTokenUsdPrice?: string): void {
  const value = getQuoteValuation(quote, inputDecimals, undefined, inputTokenUsdPrice).inputAmountUsd;
  if (value === undefined || BN(value).lt(minimumUsd)) {
    throw new Error(`Request a quote worth at least $${minimumUsd} with an available USD value.`);
  }
}
