"use client";

import { useOrderForm, usePriceDisplay } from "./use-order-form";

import { useOrderSubmitFlowStore } from "@/lib/hooks/store";
import { toAmountUI } from "@orbs-network/spot-ui";

/** Adapt the shared SDK calculation to the existing review labels. */
export function useOrderReview() {
  const currentForm = useOrderForm();
  const tokens = usePriceDisplay();
  const execution = useOrderSubmitFlowStore((state) => state.execution);
  const form = execution.form ?? currentForm;
  const inputToken = execution.inputToken ?? tokens.inputToken;
  const outputToken = execution.outputToken ?? tokens.outputToken;
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
