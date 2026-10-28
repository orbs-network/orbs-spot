import { getMinimumOutputAmount, isNativeAddress, QuoteError, type SpotClient } from "@orbs-network/spot-ui";
import { queryOptions } from "@tanstack/react-query";
import type { BestTradeQuote, Currency } from "../types";

export const SPOT_SWAP_QUOTE_KEY = ["spot-swap-quote"] as const;
export const MIN_SWAP_VALUE_USD = 10;

/** One request identity shared by previews, review refreshes, and developer tools. */
export function spotSwapQuoteQueryOptions(
  client: Pick<SpotClient, "partner" | "chainId" | "getQuote"> | undefined,
  account: string,
  inputCurrency: Currency | undefined,
  outputCurrency: Currency | undefined,
  rawAmount: string,
  slippage: number,
  wrappedNativeTokenAddress?: string,
) {
  const source = inputCurrency?.address ?? "";
  const inToken = isNativeAddress(source) ? wrappedNativeTokenAddress ?? "" : source;
  const outToken = outputCurrency?.address ?? "";
  return queryOptions({
    queryKey: [...SPOT_SWAP_QUOTE_KEY, client?.partner, client?.chainId, account.toLowerCase(), source.toLowerCase(), inToken.toLowerCase(), outToken.toLowerCase(), rawAmount, slippage, "-1"],
    queryFn: async ({ signal }): Promise<BestTradeQuote> => {
      if (!client) throw new Error("Spot configuration is not ready. Retry before requesting a quote");
      if (!inToken || !outToken || !/^\d+$/.test(rawAmount) || BigInt(rawAmount) <= BigInt(0)) {
        throw new Error("Select a token pair and enter an amount before requesting a quote");
      }
      const quote = await client.getQuote({ inToken, outToken, inAmount: rawAmount,
        user: account, slippage, dexMinAmountOut: "-1", signal });
      return {
        outAmount: quote.netAmountOut,
        minAmountOut: getMinimumOutputAmount(quote.netAmountOut, slippage),
        inToken: source,
        outToken,
        inAmount: rawAmount,
        slippage,
        originalQuote: quote,
      };
    },
    staleTime: 10_000,
    retry: (failureCount, error) => failureCount < 2 && (!(error instanceof QuoteError) || error.retryable),
  });
}
