"use client";
import { useOrderReview } from "./use-order-review";
import { getExplorerUrl } from "@/lib/utils";
import { SUPPORTED_CHAINS } from "@/lib/consts";
import { SwapFlowErrorIcon, SwapFlowLoader } from "@/components/swap-flow-loader";
import { Button } from "@/components/ui/button";
import { DetailRow } from "@/components/ui/detail-row";
import { SwapFlowTokenLogo } from "@/components/ui/swap-flow-token-logo";
import { Switch } from "@/components/ui/switch";
import { useFormatNumber } from "@/lib/hooks/common";
import { useCurrency } from "@/lib/hooks/use-currencies";
import { useTranslations } from "@/lib/use-translations";
import { DISCLAIMER_URL, isNativeAddress, Module, type Token } from "@orbs-network/spot-ui";
import { Steps, ExecutionPhase, ExecutionStatus } from "@/lib/spot/execution";
import { Step, SwapFlow, SwapStatus } from "@orbs-network/swap-ui";
import BN from "bignumber.js";
import { ArrowRightIcon, CheckIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { type Currency } from "@/lib/types";
import { formatDuration } from "./utils";
import { useSubmitOrderExecution } from "./use-submit-order-execution";
import { OrbsTradeReviewSummary } from "@/components/orbs-trade-review-summary";
import { tokenDisplayDecimals } from "@/lib/token-display";
import { IS_ORBS } from "@/lib/partners/client";
import { TransactionError } from "@/components/transaction-error";

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
      layout="order"
      pay={{ currency: srcCurrency, token: order.srcToken, amount: srcAmount, usd: srcUsd, icon: <SwapFlowTokenLogo currency={srcCurrency} token={order.srcToken} className="size-10" /> }}
      receive={{ currency: dstCurrency, token: order.dstToken, amount: dstAmount, usd: dstUsd, label: order.form.values.isMarketOrder ? "Buy · estimated" : "Buy · at limit", icon: <SwapFlowTokenLogo currency={dstCurrency} token={order.dstToken} className="size-10" /> }}
    />
  );
}

function OrderReviewDetails({ orderTitle }: { orderTitle: string }) {
  const t = useTranslations();
  const order = useOrderReview();
  const srcToken = order.srcToken;
  const dstToken = order.dstToken;
  const minReceived = useFormatNumber({
    value: order.minDestAmountPerTradeUI,
    decimalScale: tokenDisplayDecimals(dstToken?.symbol, dstToken?.decimals),
  });
  const sizePerTrade = useFormatNumber({
    value: order.sizePerTradeUI,
  });
  const triggerPrice = useFormatNumber({
    value: order.triggerPriceUI,
  });
  const limitPrice = useFormatNumber({
    value: order.limitPriceUI,
  });
  const triggerPriceUsd = useFormatNumber({ value: order.triggerPriceUsd, decimalScale: 2, prefix: "$" });
  const limitPriceUsd = useFormatNumber({ value: order.limitPriceUsd, decimalScale: 2, prefix: "$" });
  const minReceivedUsd = useFormatNumber({ value: order.form.trades.minOutputAmountPerTrade.usd, decimalScale: 2, prefix: "$" });
  const sizePerTradeUsd = useFormatNumber({ value: order.form.trades.inputAmountPerTrade.usd, decimalScale: 2, prefix: "$" });

  return (
    <div data-review-details className="mt-3 flex w-full flex-col gap-2 rounded-[14px] border border-primary/25 bg-primary/10 p-3">
      <DetailRow
        label={t("orderType")}
        align="start"
        labelClassName="text-xs leading-5"
        valueClassName="text-xs leading-5"
      >
        {orderTitle}{order.form.module !== Module.LIMIT ? order.form.values.isMarketOrder ? " Market" : " Limit" : ""}
      </DetailRow>
      <DetailRow
        label={t("expiresIn")}
        tooltip={t("expirationTooltip")}
        align="start"
        labelClassName="text-xs leading-5"
        valueClassName="text-xs leading-5"
      >
        {formatDuration(order.durationMillis)}
      </DetailRow>
      <DetailRow
        label={t("triggerPrice")}
        tooltip={t("triggerPriceTooltip")}
        hidden={BN(order.triggerPriceUI || 0).isZero()}
        align="start"
        labelClassName="text-xs leading-5"
        valueClassName="text-xs leading-5"
      >
        <span className="inline-flex flex-wrap justify-end gap-x-1.5">
          <span>1 {srcToken?.symbol} = {triggerPrice || "-"} {dstToken?.symbol}</span>
          {triggerPriceUsd && <span data-order-price-usd className="font-normal text-muted-foreground">({triggerPriceUsd})</span>}
        </span>
      </DetailRow>
      <DetailRow
        label={t("limitPrice")}
        tooltip={t("limitPriceTooltip")}
        hidden={order.form.values.isMarketOrder || BN(order.limitPriceUI || 0).isZero()}
        align="start"
        labelClassName="text-xs leading-5"
        valueClassName="text-xs leading-5"
      >
        <span className="inline-flex flex-wrap justify-end gap-x-1.5">
          <span>1 {srcToken?.symbol} = {limitPrice || "-"} {dstToken?.symbol}</span>
          {limitPriceUsd && <span data-order-price-usd className="font-normal text-muted-foreground">({limitPriceUsd})</span>}
        </span>
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

function useOrderStep(orderTitle: string, srcToken?: Token): Step | undefined {
  const t = useTranslations();
  const { currentStep: step, wrapTxHash, approvalTxHash: approveTxHash, status, phase, chainId } =
    useSubmitOrderExecution();
  const network = SUPPORTED_CHAINS.find((chain) => chain.id === chainId);
  const wrapExplorerUrl = getExplorerUrl(chainId, wrapTxHash);
  const approveExplorerUrl = getExplorerUrl(chainId, approveTxHash);
  const symbol = isNativeAddress(srcToken?.address ?? "")
    ? (network?.nativeCurrency.symbol ?? srcToken?.symbol ?? "")
    : (srcToken?.symbol ?? "");

  return useMemo(() => {
    if (step === Steps.WRAP) {
      return {
        title: t("wrapAction", { symbol }),
        footerLink: wrapExplorerUrl,
        footerText: wrapTxHash
          ? t("transactionSubmitted")
          : !wrapTxHash && status === ExecutionStatus.LOADING ? t("proceedInWallet") : undefined,
      };
    }
    if (step === Steps.APPROVE) {
      return {
        title: t("approveAction", { symbol }),
        footerLink: approveExplorerUrl,
        footerText: approveTxHash
          ? t("transactionSubmitted")
          : !approveTxHash && status === ExecutionStatus.LOADING ? t("proceedInWallet") : undefined,
      };
    }
    return {
      title: t("createOrderAction", { name: orderTitle }),
      footerText:
        status === ExecutionStatus.LOADING
          ? phase === ExecutionPhase.SIGNING
            ? t("proceedInWallet")
            : phase === ExecutionPhase.SUBMITTING ? t("transactionSubmitted") : undefined
          : undefined,
    };
  }, [
    approveExplorerUrl,
    orderTitle,
    status,
    phase,
    wrapTxHash,
    approveTxHash,
    step,
    symbol,
    t,
    wrapExplorerUrl,
  ]);
}

function OrderFlowMain({
  orderTitle,
  onSubmit,
  isSubmitting,
}: {
  orderTitle: string;
  onSubmit: () => void;
  isSubmitting?: boolean;
}) {
  const t = useTranslations();
  const [accepted, setAccepted] = useState(true);
  const order = useOrderReview();
  const { status } = useSubmitOrderExecution();
  const isSubmitted = Boolean(status);

  return (
    <>
      {IS_ORBS && !isSubmitted ? <OrderAmountSummary /> : <SwapFlow.Main
        fromTitle={t("from")}
        toTitle={t("to")}
        inUsd={<OrderUsd kind="src" />}
        outUsd={<OrderUsd kind="dst" />}
      />}
      {!isSubmitted && (
        <div className="mt-3 flex w-full flex-col gap-3">
          {order.form.values.isMarketOrder && (
            <p data-review-output-estimate className="text-xs leading-relaxed text-muted-foreground">
              {order.totalTrades > 1
                ? "Output is estimated. Each trade may execute at a different market rate, so the total received may vary."
                : "Output is estimated. The final amount depends on the market rate at execution."}
            </p>
          )}
          <OrderReviewDetails orderTitle={orderTitle} />
          <div data-review-disclaimer className="flex w-full items-center justify-between gap-3 rounded-[14px] bg-secondary/55 p-3">
            <span className="text-sm font-medium text-muted-foreground">
              Accept{" "}
              <a
                href={DISCLAIMER_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="border-b border-muted-foreground/60 transition-colors"
              >
                Disclaimer
              </a>
            </span>
            <Switch
              checked={accepted}
              onCheckedChange={setAccepted}
              aria-label="Accept order disclaimer"
            />
          </div>
          <Button
            type="button"
            data-submit-button
            className="h-12 w-full rounded-[14px] text-base"
            disabled={!accepted || isSubmitting}
            isLoading={Boolean(isSubmitting)}
            onClick={onSubmit}
          >
            Submit
          </Button>
        </div>
      )}
    </>
  );
}

function OrderUsd({ kind }: { kind: "src" | "dst" }) {
  const order = useOrderReview();
  const value = kind === "src" ? order.srcAmountUsd : order.dstAmountUsd;
  const formatted = useFormatNumber({ value, decimalScale: 2, prefix: "$" });
  return <p className="text-sm text-muted-foreground">{formatted || "$0"}</p>;
}

function OrderSuccessIcon() {
  return (
    <div data-flow-success-icon className="flex size-14 items-center justify-center rounded-full border border-primary/30 bg-primary/15 text-primary">
      <CheckIcon aria-hidden="true" className="size-7" strokeWidth={2.4} />
    </div>
  );
}

function OrderSuccessToken({
  amount,
  className,
  currency,
  token,
}: {
  amount?: string;
  className?: string;
  currency?: Currency;
  token?: Token;
}) {
  const symbol = currency?.symbol ?? token?.symbol;

  return (
    <div className={`flex min-w-0 items-center gap-2 ${className ?? ""}`}>
      <SwapFlowTokenLogo
        currency={currency}
        token={token}
        className="size-[26px]"
      />
      <span className="min-w-0 truncate text-sm font-semibold text-foreground">
        {amount || "0"} {symbol}
      </span>
    </div>
  );
}

function OrderFlowSuccess({
  dstAmount,
  dstCurrency,
  dstToken,
  srcAmount,
  srcCurrency,
  srcToken,
}: {
  dstAmount?: string;
  dstCurrency?: Currency;
  dstToken?: Token;
  srcAmount?: string;
  srcCurrency?: Currency;
  srcToken?: Token;
}) {
  const execution = useSubmitOrderExecution();
  const explorerUrl = getExplorerUrl(execution.chainId, execution.approvalTxHash ?? execution.wrapTxHash);

  return (
    <SwapFlow.StepLayout
      className="orbs_Success"
      title="Order placed"
      body={
        <div className="flex w-full flex-col items-center gap-3">
          <div data-review-pair className="grid w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 rounded-[14px] border border-primary/25 bg-primary/10 p-3">
            <OrderSuccessToken
              amount={srcAmount}
              currency={srcCurrency}
              token={srcToken}
            />
            <ArrowRightIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
            <OrderSuccessToken
              amount={dstAmount}
              className="justify-end"
              currency={dstCurrency}
              token={dstToken}
            />
          </div>
          {explorerUrl && <a href={explorerUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline">View {execution.approvalTxHash ? "approval" : "wrap"} on explorer</a>}
        </div>
      }
    />
  );
}

export function SubmitOrderPanel({
  orderTitle,
  onSubmit,
  isSubmitting,
}: {
  orderTitle: string;
  onSubmit: () => void;
  isSubmitting?: boolean;
}) {
  const { status, currentStepIndex: stepIndex, totalSteps, error: parsedError, inputToken: srcToken, outputToken: dstToken } =
    useSubmitOrderExecution();
  const order = useOrderReview();
  const srcAmount = useFormatNumber({
    decimalScale: tokenDisplayDecimals(order.srcToken?.symbol, order.srcToken?.decimals), value: order.srcAmountUI,
  });
  const dstAmount = useFormatNumber({
    decimalScale: tokenDisplayDecimals(order.dstToken?.symbol, order.dstToken?.decimals), value: order.dstAmountUI,
  });
  const currentStep = useOrderStep(orderTitle, srcToken);
  const inToken = useMemo(
    () => ({ symbol: srcToken?.symbol, logoUrl: srcToken?.logoUrl }),
    [srcToken],
  );
  const outToken = useMemo(
    () => ({ symbol: dstToken?.symbol, logoUrl: dstToken?.logoUrl }),
    [dstToken],
  );
  const srcCurrency = useCurrency(srcToken?.address);
  const dstCurrency = useCurrency(dstToken?.address);
  const tokenLogoClassName = status ? "size-[26px]" : "size-10";

  return (
    <SwapFlow
      inAmount={srcAmount}
      outAmount={dstAmount}
      swapStatus={status === ExecutionStatus.LOADING ? SwapStatus.LOADING : status === ExecutionStatus.SUCCESS ? SwapStatus.SUCCESS : status === ExecutionStatus.FAILED ? SwapStatus.FAILED : undefined}
      totalSteps={totalSteps}
      currentStep={currentStep}
      currentStepIndex={stepIndex}
      inToken={inToken}
      outToken={outToken}
      components={{
        SrcTokenLogo: (
          <SwapFlowTokenLogo
            token={srcToken}
            currency={srcCurrency}
            className={tokenLogoClassName}
          />
        ),
        DstTokenLogo: (
          <SwapFlowTokenLogo
            token={dstToken}
            currency={dstCurrency}
            className={tokenLogoClassName}
          />
        ),
        Failed: <SwapFlow.Failed error={<TransactionError error={parsedError} />} />,
        FailedIcon: <SwapFlowErrorIcon />,
        Success: (
          <OrderFlowSuccess
            dstAmount={dstAmount}
            dstCurrency={dstCurrency}
            dstToken={dstToken}
            srcAmount={srcAmount}
            srcCurrency={srcCurrency}
            srcToken={srcToken}
          />
        ),
        SuccessIcon: <OrderSuccessIcon aria-hidden="true" />,
        Main: (
          <OrderFlowMain
            orderTitle={orderTitle}
            onSubmit={onSubmit}
            isSubmitting={isSubmitting}
          />
        ),
        Loader: <SwapFlowLoader />,
      }}
    />
  );
}
