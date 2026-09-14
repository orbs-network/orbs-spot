"use client";

import { useOrderForm, usePriceDisplay, toAmountUI } from "@orbs-network/spot-react";

/** Adapt the shared SDK calculation to the existing review labels. */
export function useOrderReview() {
  const form = useOrderForm();
  const { inputToken, outputToken } = usePriceDisplay();
  return {
    form,
    srcToken: inputToken,
    dstToken: outputToken,
    srcAmountUI: form.inputAmount.ui,
    srcAmountUsd: form.inputAmount.usd,
    dstAmount: form.outputAmount.raw,
    dstAmountUI: form.outputAmount.ui,
    dstAmountUsd: form.outputAmount.usd,
    minDestAmountPerTradeUI: form.trades.minOutputAmountPerTrade.ui,
    sizePerTradeUI: form.trades.inputAmountPerTrade.ui,
    triggerPriceUI: toAmountUI(form.values.triggerPrice, outputToken?.decimals ?? 18),
    limitPriceUI: toAmountUI(form.values.limitPrice, outputToken?.decimals ?? 18),
    feesUsd: form.fees.usd,
    feesPercentage: form.fees.percentage,
    totalTrades: form.trades.totalTrades,
    tradeInterval: form.schedule.fillDelayMillis,
    durationMillis: form.schedule.durationMillis,
  };
}
