"use client";

import { useOrderReview } from "./use-order-review";
import { getExplorerUrl } from "@/lib/utils";
import { SUPPORTED_CHAINS } from "@/lib/consts";

import { LiveOrderFlowTrigger } from "@/components/developer-tools/live-order-flow-trigger";
import { SubmitSwapButton } from "@/components/submit-swap-button";
import { SwapFlowLoader } from "@/components/swap-flow-loader";
import { Button } from "@/components/ui/button";
import { DetailRow } from "@/components/ui/detail-row";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SwapFlowTokenLogo } from "@/components/ui/swap-flow-token-logo";
import { Switch } from "@/components/ui/switch";
import { useActionHandlers } from "@/lib/hooks/use-action-handlers";
import { useFormatNumber } from "@/lib/hooks/common";
import { useCurrency } from "@/lib/hooks/use-currencies";
import { useOrderSubmitFlowStore } from "@/lib/hooks/store";
import { useTranslations } from "@/lib/use-translations";
import {
  DISCLAIMER_URL,
  isNativeAddress,
  Module,
  Steps,
  ExecutionStatus,
  ExecutionPhase,
  useExecution,
  useSubmitButton,
  type ParsedError,
  type Token,
} from "@orbs-network/spot-react";
import { Step, SwapFlow, SwapStatus } from "@orbs-network/swap-ui";
import BN from "bignumber.js";
import { AlertTriangleIcon, ArrowRightIcon, CheckIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useConnection } from "wagmi";
import { Field, type Currency } from "@/lib/types";
import { formatDuration, getOrderTitle } from "./utils";

function useSubmitOrderExecution() {
  const execution = useExecution();
  // Allowance is read during preparation. Keep review visible and let the
  // submit button's isExecuting loader indicate that work is in progress.
  const showReview = execution.isRejected || execution.phase === ExecutionPhase.PREPARING;
  return {
    ...execution,
    status: showReview ? undefined : execution.status,
    error: execution.isRejected ? undefined : execution.error,
  };
}

function OrderReviewDetails({ orderTitle }: { orderTitle: string }) {
  const t = useTranslations();
  const order = useOrderReview();
  const srcToken = order.srcToken;
  const dstToken = order.dstToken;
  const minReceived = useFormatNumber({
    value: order.minDestAmountPerTradeUI,
    decimalScale: 4,
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
  const feesUsd = useFormatNumber({ value: order.feesUsd, decimalScale: 2 });

  return (
    <div className="mt-3 flex w-full flex-col gap-2 rounded-[14px] border border-primary/25 bg-primary/10 p-3">
      <DetailRow
        label={t("orderType")}
        align="start"
        labelClassName="text-xs leading-5"
        valueClassName="text-xs leading-5"
      >
        {orderTitle}
      </DetailRow>
      <DetailRow
        label={t("expirationLabel")}
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
        1 {srcToken?.symbol} = {triggerPrice || "-"} {dstToken?.symbol}
      </DetailRow>
      <DetailRow
        label={t("limitPrice")}
        tooltip={t("limitPriceTooltip")}
        hidden={BN(order.limitPriceUI || 0).isZero()}
        align="start"
        labelClassName="text-xs leading-5"
        valueClassName="text-xs leading-5"
      >
        1 {srcToken?.symbol} = {limitPrice || "-"} {dstToken?.symbol}
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
        {minReceived || "-"} {dstToken?.symbol}
      </DetailRow>
      <DetailRow
        label={t("individualTradeSize")}
        tooltip={t("tradeSizeTooltip")}
        hidden={order.totalTrades <= 1}
        align="start"
        labelClassName="text-xs leading-5"
        valueClassName="text-xs leading-5"
      >
        {sizePerTrade || "-"} {srcToken?.symbol}
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
        label={t("tradeIntervalLabel")}
        tooltip={t("tradeIntervalTooltip")}
        hidden={order.totalTrades <= 1}
        align="start"
        labelClassName="text-xs leading-5"
        valueClassName="text-xs leading-5"
      >
        {formatDuration(order.tradeInterval)}
      </DetailRow>
      <DetailRow
        label={t("fees", { value: `(${order.feesPercentage}%)` })}
        hidden={order.feesUsd === undefined || order.feesUsd === null}
        align="start"
        labelClassName="text-xs leading-5"
        valueClassName="text-xs leading-5"
      >
        ${feesUsd || "0"}
      </DetailRow>
    </div>
  );
}

function TxError({ error }: { error?: ParsedError }) {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <AlertTriangleIcon aria-hidden="true" className="size-8 text-destructive" />
      <h3 className="text-lg font-semibold">Transaction failed</h3>
      {error?.code ? (
        <p className="text-sm text-muted-foreground">
          Error code: {error.code}
        </p>
      ) : null}
      {error?.message ? (
        <p className="max-h-28 overflow-auto text-sm text-muted-foreground">
          {error.message}
        </p>
      ) : null}
    </div>
  );
}

function useOrderStep(orderTitle: string, srcToken?: Token): Step | undefined {
  const t = useTranslations();
  const { currentStep: step, wrapTxHash, approvalTxHash: approveTxHash, status, chainId } =
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
        footerText: wrapExplorerUrl
          ? t("viewOnExplorer")
          : t("proceedInWallet"),
      };
    }
    if (step === Steps.APPROVE) {
      return {
        title: t("approveAction", { symbol }),
        footerLink: approveExplorerUrl,
        footerText: approveExplorerUrl
          ? t("viewOnExplorer")
          : t("proceedInWallet"),
      };
    }
    return {
      title: t("createOrderAction", { name: orderTitle }),
      footerText:
        status === ExecutionStatus.LOADING ? t("proceedInWallet") : undefined,
    };
  }, [
    approveExplorerUrl,
    orderTitle,
    status,
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
  const { status } = useSubmitOrderExecution();
  const isSubmitted = Boolean(status);

  return (
    <>
      <SwapFlow.Main
        fromTitle={t("from")}
        toTitle={t("to")}
        inUsd={<OrderUsd kind="src" />}
        outUsd={<OrderUsd kind="dst" />}
      />
      {!isSubmitted && (
        <div className="mt-3 flex w-full flex-col gap-3">
          <OrderReviewDetails orderTitle={orderTitle} />
          <div className="flex w-full items-center justify-between gap-3 rounded-[14px] bg-secondary/55 p-3">
            <a
              href={DISCLAIMER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="border-b border-muted-foreground/60 text-sm font-medium text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
            >
              Accept Disclaimer
            </a>
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
            Submit order
          </Button>
        </div>
      )}
    </>
  );
}

function OrderUsd({ kind }: { kind: "src" | "dst" }) {
  const order = useOrderReview();
  const value = kind === "src" ? order.srcAmountUsd : order.dstAmountUsd;
  const formatted = useFormatNumber({ value, decimalScale: 2 });
  return <p className="text-sm text-muted-foreground">${formatted || "0"}</p>;
}

function OrderSuccessIcon() {
  return (
    <div className="flex size-14 items-center justify-center rounded-full border border-primary/30 bg-primary/15 text-primary">
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
  orderTitle,
  srcAmount,
  srcCurrency,
  srcToken,
}: {
  dstAmount?: string;
  dstCurrency?: Currency;
  dstToken?: Token;
  orderTitle: string;
  srcAmount?: string;
  srcCurrency?: Currency;
  srcToken?: Token;
}) {
  const t = useTranslations();

  return (
    <SwapFlow.StepLayout
      className="orbs_Success"
      title={t("createOrderActionSuccess", { name: orderTitle })}
      body={
        <div className="flex w-full flex-col items-center gap-3">
          <div className="grid w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 rounded-[14px] border border-primary/25 bg-primary/10 p-3">
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
        </div>
      }
    />
  );
}

function SubmitOrderPanel({
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
    value: order.srcAmountUI,
  });
  const dstAmount = useFormatNumber({
    value: order.dstAmountUI,
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
        Failed: <SwapFlow.Failed error={<TxError error={parsedError} />} />,
        Success: (
          <OrderFlowSuccess
            dstAmount={dstAmount}
            dstCurrency={dstCurrency}
            dstToken={dstToken}
            orderTitle={orderTitle}
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

export function SubmitOrder({ orderModule }: { orderModule: Module }) {
  const t = useTranslations();
  const {
    submitOrder: onSubmit,
    status,
    startNewOrder: resetState,
    returnToOrderForm: resetCurrentSwap,
    error: parsedError,
    isExecuting: confirmButtonLoading,
    isRejected,
  } = useSubmitOrderExecution();
  const { disabled, loading } = useSubmitButton();
  const isFetchingQuote = loading && !confirmButtonLoading;
  const { handleCurrencyChange, setInputAmount } = useActionHandlers();
  const pendingWrappedInputAddress = useOrderSubmitFlowStore(
    (state) => state.pendingWrappedInputAddress,
  );
  const setPendingWrappedInputAddress = useOrderSubmitFlowStore(
    (state) => state.setPendingWrappedInputAddress,
  );
  const { chainId } = useConnection();
  const [open, setOpen] = useState(false);
  const orderTitle = getOrderTitle(orderModule, t);

  useEffect(() => {
    if (isRejected) resetCurrentSwap();
  }, [isRejected, resetCurrentSwap]);

  useEffect(() => {
    if (open || !pendingWrappedInputAddress) return;

    // The wrapping callback can finish before or after the user closes the
    // dialog. Let its close animation finish before mutating the form.
    const switchTokenTimer = window.setTimeout(() => {
      handleCurrencyChange(pendingWrappedInputAddress, Field.INPUT);
      setPendingWrappedInputAddress(undefined);
    }, 400);

    return () => window.clearTimeout(switchTokenTimer);
  }, [
    handleCurrencyChange,
    open,
    pendingWrappedInputAddress,
    setPendingWrappedInputAddress,
  ]);

  const onOpen = useCallback(() => {
    setOpen(true);
    if (status !== ExecutionStatus.LOADING) {
      resetCurrentSwap();
    }
  }, [resetCurrentSwap, setOpen, status]);

  const closeReview = useCallback(() => {
    setOpen(false);
    if (status === ExecutionStatus.SUCCESS) {
      setInputAmount("");
      window.setTimeout(resetState, 400);
    } else if (status) {
      window.setTimeout(resetCurrentSwap, 400);
    }
  }, [resetCurrentSwap, resetState, setInputAmount, setOpen, status]);

  return (
    <div className="flex w-full items-center gap-2">
      <div className="min-w-0 flex-1">
        <Dialog
          open={open}
          onOpenChange={(nextOpen) => (nextOpen ? onOpen() : closeReview())}
        >
          <SubmitSwapButton
            onClick={onOpen}
            disabled={disabled}
            isLoading={isFetchingQuote}
            text={isFetchingQuote ? t("fetchingQuote") : t("placeOrder")}
            validateSwap={false}
            chainId={chainId}
          />
          <DialogContent
            presentation="center"
            className="w-[calc(100vw-1rem)] sm:max-w-[460px]"
          >
            <DialogHeader>
              <DialogTitle>
                {parsedError
                  ? "Error Creating Order"
                  : !status
                    ? t("orderReview")
                    : ""}
              </DialogTitle>
            </DialogHeader>
            <SubmitOrderPanel
              orderTitle={orderTitle}
              onSubmit={onSubmit}
              isSubmitting={confirmButtonLoading}
            />
          </DialogContent>
        </Dialog>
      </div>
      <LiveOrderFlowTrigger submitDisabled={disabled || loading} />
    </div>
  );
}
