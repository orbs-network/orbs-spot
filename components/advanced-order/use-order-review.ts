"use client";

import { useOrderForm, usePriceDisplay } from "./use-order-form";

import { useOrderSubmitFlowStore } from "@/lib/hooks/store";
import { toAmountUI } from "@orbs-network/spot-ui";
import BN from "bignumber.js";

/** Adapt the shared SDK calculation to the existing review labels. */
export function useOrderReview() {
  const currentForm = useOrderForm();
  const tokens = usePriceDisplay();
  const execution = useOrderSubmitFlowStore((state) => state.execution);
  const form = execution.form ?? currentForm;
  const inputToken = execution.inputToken ?? tokens.inputToken;
  const outputToken = execution.outputToken ?? tokens.outputToken;
  const triggerPriceUI = toAmountUI(form.values.triggerPrice, outputToken?.decimals ?? 18);
  const limitPriceUI = toAmountUI(form.values.limitPrice, outputToken?.decimals ?? 18);
  // Review rates always use the original output token, even when the form is inverted.
  // Reuse the review snapshot's USD price so the rate and amount estimates agree.
  const outputUnitUsd = BN(form.outputAmount.usd).div(form.outputAmount.ui);
  const priceUsd = (price: string) => {
    const value = BN(price).times(outputUnitUsd);
    return outputUnitUsd.isFinite() && outputUnitUsd.gt(0) && value.isFinite() && value.gt(0)
      ? value.toFixed() : undefined;
  };
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
    triggerPriceUI,
    limitPriceUI,
    triggerPriceUsd: priceUsd(triggerPriceUI),
    limitPriceUsd: priceUsd(limitPriceUI),
    feesUsd: form.fees.usd,
    feesPercentage: form.fees.percentage,
    totalTrades: form.trades.totalTrades,
    tradeInterval: form.schedule.fillDelayMillis,
    durationMillis: form.schedule.durationMillis,
  };
}
