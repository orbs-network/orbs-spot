"use client";

import BN from "bignumber.js";
import { useFormatNumber } from "@/lib/hooks/common";
import { useOrderModel } from "./use-order-form";
import { formatTwapDuration } from "./utils";
import type { CalculatedOrderForm, Token } from "@orbs-network/spot-ui";
import { tokenDisplayDecimals } from "@/lib/token-display";

export function TwapSummary() {
  const { form, outputToken, market } = useOrderModel();
  return <TwapSummaryDetails form={form} outputToken={outputToken} isLoading={market.isLoading} />;
}

export function TwapSummaryDetails({ form, outputToken, isLoading = false }: {
  form: CalculatedOrderForm; outputToken?: Token; isLoading?: boolean;
}) {
  const decimalScale = tokenDisplayDecimals(outputToken?.symbol, outputToken?.decimals);
  const expected = useFormatNumber({ value: form.outputAmount.ui, decimalScale });
  const minimum = useFormatNumber({ value: form.minOutputAmountTotal.ui, decimalScale });
  const { totalTrades, fillDelayMillis } = form.schedule;
  if (form.inputAmount.isEmpty || !outputToken || form.trades.error || form.schedule.fillDelayError) return null;

  const hasEstimate = BN(form.outputAmount.raw).gt(0) && !isLoading;
  const hasMinimum = BN(form.minOutputAmountTotal.raw).gt(0);

  return (
    <div data-twap-summary className="px-1 text-xs leading-relaxed text-muted-foreground">
      <p>
        {totalTrades === 1 ? "One trade" : `${totalTrades} trades · ~${formatTwapDuration((totalTrades - 1) * fillDelayMillis)} from first to last fill`}
        {" · "}{form.values.isMarketOrder ? "Est. total" : "Total at limit"}: {hasEstimate ? `${expected} ${outputToken.symbol}` : isLoading ? "Updating…" : "Quote unavailable"}
      </p>
      <p className="mt-1">
        {hasMinimum
          ? `Minimum if fully filled: ${minimum} ${outputToken.symbol}.`
          : `No fixed minimum total; ${form.values.slippageBps / 100}% price protection applies per trade.`}
        {" "}Actual fills and timing may vary.
      </p>
    </div>
  );
}
