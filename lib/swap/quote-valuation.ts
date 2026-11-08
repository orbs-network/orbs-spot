import BN from "bignumber.js";
import type { BestTradeQuote } from "../types";

// Preserve tiny unit values and avoid rounding reconstructed display totals down.
// Pass the service's exact USD totals to the SDK for amount and size validation.
const QuoteNumber = BN.clone({ DECIMAL_PLACES: 512, ROUNDING_MODE: BN.ROUND_UP });

export interface QuoteValuation {
  inputAmountUsd?: string;
  outputAmountUsd?: string;
  minimumAmountOutUsd?: string;
  inputTokenUsdPrice?: string;
  outputTokenUsdPrice?: string;
}

function validUsd(value?: string): string | undefined {
  const amount = BN(value ?? "");
  return amount.isFinite() && amount.gte(0) ? value : undefined;
}

function unitPrice(value: string | undefined, raw: string, decimals?: number): string | undefined {
  if (value === undefined || decimals === undefined) return undefined;
  const amount = new QuoteNumber(raw).shiftedBy(-decimals);
  if (!amount.isFinite() || !amount.gt(0) || !BN(value).gt(0)) return undefined;
  return new QuoteNumber(value).div(amount).toFixed();
}

/** Preserve each service-reported USD total and derive unit values for edited amounts. */
export function getQuoteValuation(
  quote?: BestTradeQuote,
  inputDecimals?: number,
  outputDecimals?: number,
): QuoteValuation {
  if (!quote) return {};
  const inputAmountUsd = validUsd(quote.originalQuote.inputAmountUsd);
  const outputAmountUsd = validUsd(quote.originalQuote.netAmountOutUsd);
  return {
    inputAmountUsd,
    outputAmountUsd,
    minimumAmountOutUsd: validUsd(quote.originalQuote.minimumAmountOutUsd),
    inputTokenUsdPrice: unitPrice(inputAmountUsd, quote.inAmount, inputDecimals),
    outputTokenUsdPrice: unitPrice(outputAmountUsd, quote.outAmount, outputDecimals),
  };
}

export function assertMinimumQuoteValue(quote: BestTradeQuote, minimumUsd: number): void {
  const value = validUsd(quote.originalQuote.inputAmountUsd);
  if (value === undefined || BN(value).lt(minimumUsd)) {
    throw new Error(`Request a quote worth at least $${minimumUsd} with an available USD value.`);
  }
}
