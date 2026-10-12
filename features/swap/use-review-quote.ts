"use client";

import { useBestTradeSwapStore } from "@/lib/hooks/store";
import { useDerivedSwap } from "@/lib/hooks/use-derived-swap";
import { toAmountUI } from "@/lib/utils";

export function useReviewQuote() {
  const current = useDerivedSwap();
  const reviewed = useBestTradeSwapStore(state => state.reviewedQuote);
  const quote = reviewed ?? current.trade?.originalQuote;
  return { ...current, quote,
    outputAmount: quote ? toAmountUI(quote.outAmount, current.outputCurrency?.decimals) : current.outputAmount,
  };
}
