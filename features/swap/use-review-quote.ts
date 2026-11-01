"use client";

import { useBestTradeSwapStore } from "@/lib/hooks/store";
import { useDerivedSwap } from "@/lib/hooks/use-derived-swap";
import type { BestTradeQuote } from "@/lib/types";
import { toAmountUI } from "@/lib/utils";
import { createContext, useContext } from "react";

type ReviewQuote = ReturnType<typeof useDerivedSwap> & { quote: BestTradeQuote | undefined };

export type SwapReviewSnapshot = {
  state: ReturnType<typeof useBestTradeSwapStore.getState>;
  quote: ReviewQuote;
  isPreparing: boolean;
  walletBusy: boolean;
};

// The dialog remains mounted during its exit animation, after the live form resets.
export const SwapReviewSnapshotContext = createContext<SwapReviewSnapshot | null>(null);

export function useSwapReviewState() {
  const live = useBestTradeSwapStore();
  const snapshot = useContext(SwapReviewSnapshotContext);
  return snapshot?.state ?? live;
}

export function useReviewQuote(): ReviewQuote {
  const current = useDerivedSwap();
  const reviewed = useBestTradeSwapStore(state => state.reviewedQuote);
  const snapshot = useContext(SwapReviewSnapshotContext);
  const quote = reviewed ?? current.trade;
  return snapshot?.quote ?? { ...current, quote,
    outputAmount: quote ? toAmountUI(quote.outAmount, current.outputCurrency?.decimals) : current.outputAmount,
  };
}
