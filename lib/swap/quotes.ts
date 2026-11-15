import { toBestTradeQuote } from "./quote-review.ts";
import { isNativeAddress } from "../spot/token-utils.ts";
import { QuoteError, type SpotClient } from "@orbs-network/spot-ui";
import { queryOptions } from "@tanstack/react-query";
import type { BestTradeQuote, Currency } from "../types";

export const SPOT_SWAP_QUOTE_KEY = ["spot-swap-quote"] as const;
export const MIN_SWAP_VALUE_USD = 10;

export type SwapAmountSide = "input" | "output";

/** Match the edited amount while keeping an output quote's resolved spend intact. */
export function matchesSpotSwapQuoteAmount(
  quote: BestTradeQuote | undefined,
  rawAmount: string,
  amountSide: SwapAmountSide = "input",
): boolean {
  if (!quote) return false;
  const original = quote.originalQuote;
  return amountSide === "output"
    ? original.requestedOutAmount === rawAmount
    : original.requestedOutAmount === undefined && original.request.inAmount === rawAmount;
}

/** One request identity shared by previews, review refreshes, and developer tools. */
export function spotSwapQuoteQueryOptions(
  client: Pick<SpotClient, "partner" | "chainId" | "getQuote"> | undefined,
  account: string,
  inputCurrency: Currency | undefined,
  outputCurrency: Currency | undefined,
  rawAmount: string,
  slippage: number,
  wrappedNativeTokenAddress?: string,
  amountSide: SwapAmountSide = "input",
) {
  const source = inputCurrency?.address ?? "";
  const inToken = isNativeAddress(source) ? wrappedNativeTokenAddress ?? "" : source;
  const outToken = outputCurrency?.address ?? "";
  return queryOptions({
    queryKey: [...SPOT_SWAP_QUOTE_KEY, client?.partner, client?.chainId, account.toLowerCase(), source.toLowerCase(), inToken.toLowerCase(), outToken.toLowerCase(), amountSide, rawAmount, slippage, "-1"],
    queryFn: async ({ signal }): Promise<BestTradeQuote> => {
      if (!client) throw new Error("Spot configuration is not ready. Retry before requesting a quote");
      if (!inToken || !outToken || !/^\d+$/.test(rawAmount) || BigInt(rawAmount) <= BigInt(0)) {
        throw new Error("Select a token pair and enter an amount before requesting a quote");
      }
      const quote = await client.getQuote({ inToken, outToken,
        ...(amountSide === "output" ? { outAmount: rawAmount } : { inAmount: rawAmount, dexMinAmountOut: "-1" }),
        user: account, slippage, signal });
      const trade = toBestTradeQuote(quote, source);
      if (!matchesSpotSwapQuoteAmount(trade, rawAmount, amountSide)) {
        throw new Error("Quote does not match the requested swap amount. Request a new quote.");
      }
      return trade;
    },
    staleTime: 10_000,
    retry: (failureCount, error) => failureCount < 2 && (!(error instanceof QuoteError) || error.retryable),
  });
}
