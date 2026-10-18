"use client";

import { Module } from "@orbs-network/spot-ui";
import BN from "bignumber.js";
import { TokenExchangeRate } from "@/components/exchange-rate";
import { TradeDetails } from "@/components/trade-details";
import { DetailRow } from "@/components/ui/detail-row";
import { Skeleton } from "@/components/ui/skeleton";
import { InfoTooltip } from "@/components/ui/form-label";
import { getExchangeRatesFromPrice } from "@/lib/exchange-rates";
import { formatDisplayAmount } from "@/lib/token-display";
import { useOrderModel } from "./use-order-form";
import { formatTwapDuration } from "./utils";
import { useOrderExpiry } from "./use-order-expiry";

export function AdvancedOrderSummary() {
  const { form, inputToken, outputToken, market } = useOrderModel();
  const { schedule, trades, inputAmount } = form;
  const duration = Math.max(0, schedule.totalTrades - 1) * schedule.fillDelayMillis;
  const validDuration = Number.isFinite(duration) && duration > 0 && !schedule.fillDelayError && !trades.error;
  const hasAmount = inputToken && !inputAmount.isEmpty && !trades.error;
  const showSchedule = form.module === Module.TWAP && schedule.totalTrades > 1;
  const minimumReceived = trades.minOutputAmountPerTrade;
  const hasMinimumReceived = outputToken?.symbol && !inputAmount.isEmpty && !trades.error && !form.limitPrice.error && BN(minimumReceived.raw).gt(0);
  const expiry = useOrderExpiry(schedule.durationMillis, Boolean(schedule.durationError));
  const rates = getExchangeRatesFromPrice(form.marketPrice.ui);
  const rate = market.isLoading && !inputAmount.isEmpty
    ? <Skeleton role="status" aria-label="Loading market rate…" className="h-4 w-36 max-w-full" />
    : rates && inputToken?.symbol && outputToken?.symbol
      ? <TokenExchangeRate rates={rates} inputCurrency={inputToken} outputCurrency={outputToken} />
      : "N/A";

  return (
    <TradeDetails data-advanced-order-summary label={`Order expiry: ${expiry.label}. Order details`} heading={
      <>
        <span className="flex items-center gap-1.5">
          <span>Order expiry</span>
          <InfoTooltip
            ariaLabel="Order expiry information"
            buttonClassName="pointer-events-auto relative z-10 inline-flex size-4 shrink-0 items-center justify-center"
            iconClassName="size-3.5"
            tooltip={expiry.tooltip}
          />
        </span>
        <time data-order-expiry dateTime={expiry.dateTime} className="ml-auto text-right tabular-nums">{expiry.label}</time>
      </>
    }>
      <DetailRow label="Market rate" value={rate} />
      {showSchedule && (
        <>
          <DetailRow label="Estimated execution time" tooltip="Estimated time from the first fill to the last: (total trades − 1) × time between trades. This excludes waiting for the first fill. Market conditions and execution delays may extend completion. Order expiry is a separate deadline." value={
            <span data-estimated-duration>{validDuration ? `~${formatTwapDuration(duration)}` : "—"}</span>
          } />
          <DetailRow label="Amount per trade" value={hasAmount ? (
            <span data-per-trade-amount className="wrap-anywhere tabular-nums">
              {formatDisplayAmount(trades.inputAmountPerTrade.ui)} {inputToken.symbol}
              {trades.inputAmountPerTrade.usd && <span className="text-muted-foreground"> ({formatDisplayAmount(trades.inputAmountPerTrade.usd, { decimalScale: 2, prefix: "$" })})</span>}
            </span>
          ) : "—"} />
        </>
      )}
      {!form.values.isMarketOrder && <DetailRow
        label={schedule.totalTrades > 1 ? "Minimum received per trade" : "Minimum received"}
        tooltip={schedule.totalTrades > 1
          ? "Minimum output for each executed trade at your limit price. Unfilled trades are not included; the order can expire partially filled."
          : "Minimum output if the trade executes at your limit price. Execution is not guaranteed before expiry."}
        value={<span data-minimum-received className="wrap-anywhere tabular-nums">
          {hasMinimumReceived ? <>
            {formatDisplayAmount(minimumReceived.ui)} {outputToken.symbol}
            {minimumReceived.usd && <span className="text-muted-foreground"> ({formatDisplayAmount(minimumReceived.usd, { decimalScale: 2, prefix: "$" })})</span>}
          </> : "N/A"}
        </span>}
      />}
      <DetailRow label="Price protection" tooltip="The maximum price deviation allowed when executing each trade." value={`${formatDisplayAmount(form.values.slippageBps / 100)}%`} />
    </TradeDetails>
  );
}
