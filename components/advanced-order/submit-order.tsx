"use client";
import { useDeveloperMode } from "@/lib/hooks/use-developer-mode";
import { LiveOrderFlowTrigger } from "@developer-tools";
import { SubmitSwapButton } from "@/components/submit-swap-button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useActionHandlers } from "@/lib/hooks/use-action-handlers";
import { useOrderSubmitFlowStore } from "@/lib/hooks/store";
import { useTranslations } from "@/lib/use-translations";
import { IS_ORBS } from "@/lib/partners/client";
import { Module } from "@orbs-network/spot-ui";
import { ExecutionStatus } from "@/lib/spot/execution";
import { useSubmitButton } from "./use-order-execution";
import { useCallback, useEffect, useRef } from "react";
import { useConnection } from "wagmi";
import { Field } from "@/lib/types";
import { getOrderTitle } from "./utils";
import { useSubmitOrderExecution } from "./use-submit-order-execution";
import { SubmitOrderPanel } from "./review-panel";

export function SubmitOrder({ orderModule }: { orderModule: Module }) {
  const { isDeveloperMode } = useDeveloperMode();
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
  const { chainId, address: account } = useConnection();
  const pendingWrappedContext = useOrderSubmitFlowStore(state => state.pendingWrappedContext);
  const open = useOrderSubmitFlowStore(state => state.isReviewOpen);
  const setOpen = useOrderSubmitFlowStore(state => state.setReviewOpen);
  useEffect(() => {
    if (isDeveloperMode) setOpen(false);
    return () => setOpen(false);
  }, [isDeveloperMode, setOpen]);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(resetTimer.current), []);
  const orderTitle = getOrderTitle(orderModule, t);
  const dialogTitle = parsedError
    ? "Order not submitted"
    : !status
      ? t("orderReview")
      : status === ExecutionStatus.SUCCESS
        ? "Order submitted"
        : "Order execution";

  useEffect(() => {
    if (isRejected) resetCurrentSwap();
  }, [isRejected, resetCurrentSwap]);

  useEffect(() => {
    if (open || !pendingWrappedInputAddress) return;

    // The wrapping callback can finish before or after the user closes the
    // dialog. Let its close animation finish before mutating the form.
    const switchTokenTimer = window.setTimeout(() => {
      if (pendingWrappedContext && pendingWrappedContext.chainId === chainId && pendingWrappedContext.account.toLowerCase() === account?.toLowerCase()) {
        handleCurrencyChange(pendingWrappedInputAddress, Field.INPUT);
      }
      setPendingWrappedInputAddress(undefined);
    }, 400);

    return () => window.clearTimeout(switchTokenTimer);
  }, [
    handleCurrencyChange,
    open,
    pendingWrappedInputAddress,
    pendingWrappedContext,
    chainId,
    account,
    setPendingWrappedInputAddress,
  ]);

  const onOpen = useCallback(() => {
    clearTimeout(resetTimer.current);
    setOpen(true);
    if (status !== ExecutionStatus.LOADING) {
      resetCurrentSwap();
    }
  }, [resetCurrentSwap, setOpen, status]);

  const closeReview = useCallback(() => {
    setOpen(false);
    if (status === ExecutionStatus.SUCCESS) {
      setInputAmount("");
      resetTimer.current = setTimeout(resetState, 400);
    } else if (status) {
      resetTimer.current = setTimeout(resetCurrentSwap, 400);
    }
  }, [resetCurrentSwap, resetState, setInputAmount, setOpen, status]);

  if (isDeveloperMode) {
    return (
      <div className="flex w-full items-center gap-2">
        <LiveOrderFlowTrigger mode="live" submitDisabled={disabled || loading} />
        <LiveOrderFlowTrigger mode="demo" />
      </div>
    );
  }

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
            text={isFetchingQuote ? t("fetchingQuote") : "Review"}
            validateSwap={false}
            chainId={chainId}
          />
          <DialogContent
            data-trade-review
            presentation="center"
            className={`w-[calc(100vw-1rem)] ${IS_ORBS ? "sm:max-w-[520px]" : "sm:max-w-[460px]"}`}
          >
            {IS_ORBS && (status || parsedError) ? (
              <DialogTitle className="sr-only">{dialogTitle}</DialogTitle>
            ) : (
              <DialogHeader><DialogTitle>{dialogTitle}</DialogTitle></DialogHeader>
            )}
            <SubmitOrderPanel
              orderTitle={orderTitle}
              onSubmit={onSubmit}
              isSubmitting={confirmButtonLoading}
            />
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
