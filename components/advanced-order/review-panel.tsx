"use client";
import { useOrderReview } from "./use-order-review";
import { cn, getExplorerUrl } from "@/lib/utils";
import { SUPPORTED_CHAINS } from "@/lib/consts";
import { Button } from "@/components/ui/button";
import { DetailRow } from "@/components/ui/detail-row";
import { SwapFlowTokenLogo } from "@/components/ui/swap-flow-token-logo";
import { Switch } from "@/components/ui/switch";
import { useFormatNumber } from "@/lib/hooks/common";
import { useCurrency } from "@/lib/hooks/use-currencies";
import { useTranslations } from "@/lib/use-translations";
import { DISCLAIMER_URL, isNativeAddress } from "@orbs-network/spot-ui";
import { Steps, ExecutionPhase } from "@/lib/spot/execution";
import BN from "bignumber.js";
import { useState } from "react";
import { ArrowRightIcon } from "lucide-react";
import { formatDuration } from "./utils";
import { OrbsTradeReviewSummary } from "@/components/orbs-trade-review-summary";
import { formatDisplayAmount, tokenDisplayDecimals } from "@/lib/token-display";
import { ExchangeRate } from "@/components/exchange-rate";
import { getExchangeRatesFromPrice } from "@/lib/exchange-rates";
import { useOrderExpiry } from "./use-order-expiry";
import { SubmissionSteps, SubmissionOutcome, SubmissionSuccess, type SubmissionStep } from "@/components/submission-status";
import type { OrderExecution } from "./use-order-execution";

function OrderAmountSummary() {
  const order = useOrderReview();
  const srcCurrency = useCurrency(order.srcToken?.address);
  const dstCurrency = useCurrency(order.dstToken?.address);
  const srcAmount = useFormatNumber({ decimalScale: tokenDisplayDecimals(order.srcToken?.symbol, order.srcToken?.decimals), value: order.srcAmountUI });
  const dstAmount = useFormatNumber({ decimalScale: tokenDisplayDecimals(order.dstToken?.symbol, order.dstToken?.decimals), value: order.dstAmountUI });
  const srcUsd = useFormatNumber({ value: order.srcAmountUsd, decimalScale: 2, prefix: "$" });
  const dstUsd = useFormatNumber({ value: order.dstAmountUsd, decimalScale: 2, prefix: "$" });

  return (
    <OrbsTradeReviewSummary
      layout="submission"
      pay={{ label: "Sell", currency: srcCurrency, token: order.srcToken, amount: srcAmount, usd: srcUsd, icon: <SwapFlowTokenLogo currency={srcCurrency} token={order.srcToken} className="size-9" /> }}
      receive={{ currency: dstCurrency, token: order.dstToken, amount: dstAmount, usd: dstUsd, label: order.form.values.isMarketOrder ? "Buy · estimated" : "Buy · at limit", icon: <SwapFlowTokenLogo currency={dstCurrency} token={order.dstToken} className="size-9" /> }}
    />
  );
}

function MarketOrderNotice() {
  const order = useOrderReview();
  if (!order.form.values.isMarketOrder) return null;
  return <p data-market-order-notice className="mt-3 text-xs leading-relaxed text-muted-foreground">
    The buy amount is an estimate. Each trade executes at the market price at the time of execution, so the amount you receive may vary.
  </p>;
}

function OrderReviewDetails() {
  const t = useTranslations();
  const order = useOrderReview();
  const expiry = useOrderExpiry(order.durationMillis, Boolean(order.form.schedule.durationError));
  const srcToken = order.srcToken;
  const dstToken = order.dstToken;
  const minReceived = useFormatNumber({
    value: order.minDestAmountPerTradeUI,
    decimalScale: tokenDisplayDecimals(dstToken?.symbol, dstToken?.decimals),
  });
  const sizePerTrade = useFormatNumber({
    value: order.sizePerTradeUI,
  });
  const triggerRates = getExchangeRatesFromPrice(order.triggerPriceUI);
  const limitRates = getExchangeRatesFromPrice(order.limitPriceUI);
  const inputUnitUsd = BN(order.srcAmountUsd).div(order.srcAmountUI);
  const reverseUsd = (rate?: BN) => {
    const value = rate?.times(inputUnitUsd);
    return value?.isFinite() && value.gt(0) ? formatDisplayAmount(value.toFixed(), { decimalScale: 2, prefix: "$" }) : undefined;
  };
  const triggerPriceUsd = useFormatNumber({ value: order.triggerPriceUsd, decimalScale: 2, prefix: "$" });
  const limitPriceUsd = useFormatNumber({ value: order.limitPriceUsd, decimalScale: 2, prefix: "$" });
  const minReceivedUsd = useFormatNumber({ value: order.form.trades.minOutputAmountPerTrade.usd, decimalScale: 2, prefix: "$" });
  const sizePerTradeUsd = useFormatNumber({ value: order.form.trades.inputAmountPerTrade.usd, decimalScale: 2, prefix: "$" });

  return (
    <div data-review-details className="mt-3 flex w-full flex-col gap-2 rounded-[14px] border border-primary/25 bg-primary/10 p-3">
      <DetailRow
        label="Order expiry"
        tooltip={expiry.tooltip}
        align="start"
        labelClassName="text-xs leading-5"
        valueClassName="text-xs leading-5"
      >
        <time data-review-order-expiry dateTime={expiry.dateTime}>{expiry.label}</time>
      </DetailRow>
      <DetailRow
        label={t("triggerPrice")}
        tooltip={t("triggerPriceTooltip")}
        hidden={BN(order.triggerPriceUI || 0).isZero()}
        align="start"
        labelClassName="text-xs leading-5"
        valueClassName="text-xs leading-5"
      >
        <ExchangeRate rates={triggerRates} inputSymbol={srcToken?.symbol} outputSymbol={dstToken?.symbol} forwardUsd={triggerPriceUsd || undefined} reverseUsd={reverseUsd(triggerRates?.reverse)} />
      </DetailRow>
      <DetailRow
        label={t("limitPrice")}
        tooltip={t("limitPriceTooltip")}
        hidden={order.form.values.isMarketOrder || BN(order.limitPriceUI || 0).isZero()}
        align="start"
        labelClassName="text-xs leading-5"
        valueClassName="text-xs leading-5"
      >
        <ExchangeRate rates={limitRates} inputSymbol={srcToken?.symbol} outputSymbol={dstToken?.symbol} forwardUsd={limitPriceUsd || undefined} reverseUsd={reverseUsd(limitRates?.reverse)} />
      </DetailRow>
      <DetailRow
        label={
          order.totalTrades > 1 ? t("minReceivedPerTrade") : t("minReceived")
        }
        tooltip={t("minDstAmountTooltip")}
        hidden={BN(order.minDestAmountPerTradeUI || 0).isZero()}
        align="start"
        labelClassName="text-xs leading-5"
        valueClassName="text-xs leading-5"
      >
        <span className="inline-flex flex-wrap justify-end gap-x-1.5">
          <span>{minReceived || "-"} {dstToken?.symbol}</span>
          {minReceivedUsd && <span data-order-amount-usd className="font-normal text-muted-foreground">({minReceivedUsd})</span>}
        </span>
      </DetailRow>
      <DetailRow
        label={t("numberOfTrades")}
        tooltip={t("totalTradesTooltip")}
        hidden={order.totalTrades <= 1}
        align="start"
        labelClassName="text-xs leading-5"
        valueClassName="text-xs leading-5"
      >
        {order.totalTrades}
      </DetailRow>
      <DetailRow
        label={t("individualTradeSize")}
        tooltip={t("tradeSizeTooltip")}
        hidden={order.totalTrades <= 1}
        align="start"
        labelClassName="text-xs leading-5"
        valueClassName="text-xs leading-5"
      >
        <span className="inline-flex flex-wrap justify-end gap-x-1.5">
          <span>{sizePerTrade || "-"} {srcToken?.symbol}</span>
          {sizePerTradeUsd && <span data-order-amount-usd className="font-normal text-muted-foreground">({sizePerTradeUsd})</span>}
        </span>
      </DetailRow>
      <DetailRow
        label={t("tradeIntervalLabel")}
        tooltip={t("tradeIntervalTooltip")}
        hidden={order.totalTrades <= 1}
        align="start"
        labelClassName="text-xs leading-5"
        valueClassName="text-xs leading-5"
      >
        {formatDuration(order.tradeInterval)}
      </DetailRow>
    </div>
  );
}

function OrderSuccess({ execution, onClose, onViewOrder }: { execution: OrderExecution; onClose: () => void; onViewOrder: () => void }) {
  return <SubmissionSuccess
    message="Your order has been placed successfully."
    onClose={onClose}
  >
    {execution.order && <button type="button" data-hover="text" onClick={onViewOrder}>
      View order<ArrowRightIcon aria-hidden="true" className="size-3" />
    </button>}
  </SubmissionSuccess>;
}

function OrderSubmissionActions({
  execution,
  onClose,
  onViewOrder,
}: {
  execution: OrderExecution;
  onClose: () => void;
  onViewOrder: () => void;
}) {
  const [accepted, setAccepted] = useState(true);
  const t = useTranslations();
  const { view, phase, error, inputToken, chainId, steps, currentStepIndex, wrapTxHash, approvalTxHash, submitDisabled, submitOrder, returnToReview, walletBusy } = execution;
  const network = SUPPORTED_CHAINS.find(chain => chain.id === chainId);
  const symbol = isNativeAddress(inputToken?.address ?? "") ? network?.nativeCurrency.symbol ?? inputToken?.symbol ?? "" : inputToken?.symbol ?? "";
  const stepTitles = {
    [Steps.WRAP]: t("wrapAction", { symbol }),
    [Steps.APPROVE]: t("approveAction", { symbol }),
    [Steps.CREATE]: "Sign and submit order",
  };
  const walletSteps = steps?.map((id): SubmissionStep => {
    const transactionHash = id === Steps.WRAP ? wrapTxHash : id === Steps.APPROVE ? approvalTxHash : undefined;
    return {
      id,
      title: stepTitles[id],
      action: id === Steps.CREATE ? "sign" : id,
      transactionHash,
      transactionUrl: getExplorerUrl(chainId, transactionHash),
    };
  }) ?? [];
  const failed = view === "failed";
  const preparing = view === "preparing";
  const showReview = view === "review" || preparing;
  const waitingForReceipt = Boolean((phase === ExecutionPhase.WRAPPING && wrapTxHash) || (phase === ExecutionPhase.APPROVING && approvalTxHash));
  const instruction = phase === ExecutionPhase.SUBMITTING ? "Placing your order…"
    : waitingForReceipt ? "Waiting for confirmation…"
    : phase === ExecutionPhase.SIGNING ? "Confirm the signature in your wallet."
    : phase === ExecutionPhase.WRAPPING ? "Confirm wrapping in your wallet."
    : "Confirm approval in your wallet.";

  if (view === "success") return <OrderSuccess execution={execution} onClose={onClose} onViewOrder={onViewOrder} />;

  return <div data-order-submission-actions className={cn("flex w-full flex-col gap-3", !failed && "mt-3")}>
    {!showReview ? <>
      <section data-order-submission-status role={failed ? "alert" : "status"} aria-live={failed ? "assertive" : "polite"} aria-atomic="true" className={cn("flex flex-col gap-2", !failed && "pt-1")}>
        {failed && <SubmissionOutcome outcome="error" title="Order submission failed" message={error?.message ?? "The order could not be submitted. Please try again."} />}
        {view === "progress" && <SubmissionSteps steps={walletSteps} activeStep={currentStepIndex ?? 0} instruction={instruction} />}
      </section>
      {failed && <Button className="h-12 w-full rounded-[14px] text-base" onClick={returnToReview}>Back to review</Button>}
    </> : <>
      <div data-review-disclaimer className="flex w-full items-center justify-between gap-3 rounded-[14px] bg-secondary/55 p-3">
        <span className="text-sm font-medium text-muted-foreground">Accept{" "}<a href={DISCLAIMER_URL} target="_blank" rel="noopener noreferrer" className="border-b border-muted-foreground/60 transition-colors hover:text-foreground">Disclaimer</a></span>
        <Switch checked={accepted} onCheckedChange={setAccepted} disabled={preparing} aria-label="Accept order disclaimer" />
      </div>
      <Button type="button" data-submit-button className="h-12 w-full rounded-[14px] text-base" disabled={!accepted || submitDisabled} isLoading={preparing} aria-busy={preparing} onClick={() => submitOrder()}>Submit</Button>
      {preparing && <span role="status" className="sr-only">Checking token allowance…</span>}
      {walletBusy && !preparing && <p role="status" className="text-xs text-muted-foreground">Confirm the pending wallet request to submit this order.</p>}
    </>}
  </div>;
}

export function SubmitOrderPanel({
  execution,
  onClose,
  onViewOrder,
}: {
  execution: OrderExecution;
  onClose: () => void;
  onViewOrder: () => void;
}) {
  const { view } = execution;
  const showDetails = view === "review" || view === "preparing";
  return <>
    {(showDetails || view === "progress") && <OrderAmountSummary />}
    {showDetails && <MarketOrderNotice />}
    {showDetails && <OrderReviewDetails />}
    <OrderSubmissionActions execution={execution} onClose={onClose} onViewOrder={onViewOrder} />
  </>;
}
