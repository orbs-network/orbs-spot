"use client";
import { trackFunnel } from "@/lib/funnel-analytics";
import { useDeveloperMode } from "@/lib/hooks/use-developer-mode";
import { LiveOrderFlowTrigger } from "@developer-tools";
import { SubmitSwapButton } from "@/components/submit-swap-button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useActionHandlers } from "@/lib/hooks/use-action-handlers";
import { useOrderSubmitFlowStore } from "@/lib/hooks/store";
import { useTranslations } from "@/lib/use-translations";
import { Module, type Order } from "@orbs-network/spot-ui";
import { ExecutionPhase } from "@/lib/spot/execution";
import { useOrderExecution } from "./use-order-execution";
import { useEffect, useState } from "react";
import { useConnection } from "wagmi";
import { getOrderTitle } from "./utils";
import { SubmitOrderPanel } from "./review-panel";
import { useOrderReview } from "./use-order-review";
import { OrderDetailsModal } from "@/features/order-history/details-modal";

export function SubmitOrder({ orderModule }: { orderModule: Module }) {
  const { isDeveloperPlayground } = useDeveloperMode();
  const t = useTranslations();
  const execution = useOrderExecution();
  const [previewOrder, setPreviewOrder] = useState<Order>();
  const { phase, view, isSubmitting, submitDisabled, quoteLoading, returnToReview } = execution;
  const isFetchingQuote = quoteLoading && !isSubmitting;
  const { setInputAmount } = useActionHandlers();
  const pendingWrappedInputAddress = useOrderSubmitFlowStore(
    (state) => state.pendingWrappedInputAddress,
  );
  const { chainId, address } = useConnection();
  const open = useOrderSubmitFlowStore(state => state.isReviewOpen);
  const setOpen = useOrderSubmitFlowStore(state => state.setReviewOpen);
  useEffect(() => {
    if (isDeveloperPlayground) setOpen(false);
    return () => setOpen(false);
  }, [isDeveloperPlayground, setOpen]);
  const orderTitle = getOrderTitle(orderModule, t);
  const order = useOrderReview();
  const orderType = order.form.module === Module.LIMIT
    ? orderTitle
    : `${orderTitle} ${order.form.values.isMarketOrder ? "Market" : "Limit"}`;

  useEffect(() => {
    if (phase === ExecutionPhase.REJECTED) returnToReview();
  }, [phase, returnToReview]);

  useEffect(() => {
    if (open || isSubmitting || (view === "review" && !pendingWrappedInputAddress)) return;

    // Reset after the close animation. If a wallet action finishes while the
    // dialog is closed, wait for it before applying a confirmed wrapped input.
    const timer = window.setTimeout(returnToReview, 400);
    return () => window.clearTimeout(timer);
  }, [open, isSubmitting, view, pendingWrappedInputAddress, returnToReview]);

  function openReview() {
    trackFunnel({ name: "review_opened", product: "advanced" });
    if (!isSubmitting) returnToReview();
    setOpen(true);
  }

  function closeReview() {
    setOpen(false);
    if (view === "success") setInputAmount("");
  }

  function viewOrder() {
    if (!execution.order) return;
    // Retain the created order independently of the submission flow's reset.
    setPreviewOrder(execution.order);
    closeReview();
  }

  if (isDeveloperPlayground) {
    return (
      <div className="flex w-full items-center gap-2">
        <LiveOrderFlowTrigger mode="live" submitDisabled={submitDisabled || quoteLoading} />
        <LiveOrderFlowTrigger mode="demo" />
      </div>
    );
  }

  return (
    <div className="flex w-full items-center gap-2">
      <div className="min-w-0 flex-1">
        <Dialog
          open={open}
          onOpenChange={(nextOpen) => (nextOpen ? openReview() : closeReview())}
        >
          <SubmitSwapButton
            onClick={openReview}
            disabled={submitDisabled}
            isLoading={isFetchingQuote}
            text={isFetchingQuote ? t("fetchingQuote") : "Review"}
            validateSwap={false}
            chainId={chainId}
          />
          <DialogContent
            data-trade-review
            data-order-submit-review
            presentation="center"
            onCloseAutoFocus={event => { if (previewOrder) event.preventDefault(); }}
            className="flex flex-col w-[calc(100vw-1rem)] overflow-hidden sm:max-w-[460px]"
          >
            <DialogHeader><DialogTitle>{view === "success" ? "Order placed" : orderType}</DialogTitle></DialogHeader>
            <div data-review-scroll className="min-h-0 min-w-0 overflow-x-hidden overflow-y-auto overscroll-contain">
              <SubmitOrderPanel execution={execution} onClose={closeReview} onViewOrder={viewOrder} />
            </div>
          </DialogContent>
        </Dialog>
        <OrderDetailsModal
          orderId={previewOrder?.historyKey}
          order={previewOrder}
          chainId={previewOrder?.chainId ?? chainId ?? 0}
          hasWallet={Boolean(address)}
          loading={false}
          error={null}
          onClose={() => setPreviewOrder(undefined)}
          onCloseAutoFocus={event => {
            event.preventDefault();
            document.querySelector<HTMLInputElement>('[data-advanced-order-content] [name="source-amount"]')?.focus({ preventScroll: true });
          }}
        />
      </div>
    </div>
  );
}
