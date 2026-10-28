"use client";
import { useRecentOrder } from "@/lib/spot/recent-order";
import { trackFunnel } from "@/lib/funnel-analytics";

import { toast } from "sonner";
import { CREATE_ORDER_TOAST_ID } from "./constants";
import { useConnection } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { invalidateOrderQueries } from "@/lib/spot/queries";
import { useOrderSubmitFlowStore, useSwapStore } from "@/lib/hooks/store";
import { getWrappedNativeCurrency } from "@/lib/utils";
import {
  createOrderExecutor,
  ExecutionPhase,
  ExecutionStatus,
} from "@/lib/spot/execution";
import { useOrderModel } from "./use-order-form";
import { useClient } from "./use-order-client";
import { useWalletInteractions } from "./hooks";
import { isUserRejectedError } from "@/lib/tx-rejection";
import { useCallback, useSyncExternalStore } from "react";
import { isNativeAddress } from "@orbs-network/spot-ui";
import { useActionHandlers } from "@/lib/hooks/use-action-handlers";
import { Field } from "@/lib/types";
import { getOrderDraftKey } from "@/lib/spot/form";
import { createOrderSubmissionManager } from "@/lib/spot/order-submissions";
import { acquireSubmissionLock, isSubmissionBusy, subscribeSubmissionLock } from "@/lib/spot/submission-lock";

// Every invocation owns its executor. Only the current review can publish into
// the form; closing it leaves the captured submission and its toast running.
const submissions = createOrderSubmissionManager((execution) =>
  useOrderSubmitFlowStore.setState({ execution: execution ?? { phase: ExecutionPhase.IDLE } }),
);

// Preflight errors occur before the executor publishes a phase snapshot.
class SubmissionPreflightError extends Error {}

type SubmissionView = "review" | "preparing" | "progress" | "success" | "failed";

// Call once in SubmitOrder and pass the result to its review/status components.
// This hook owns app state; lib/spot/execution.ts shows the wallet + SDK sequence.
export function useOrderExecution() {
  const snapshot = useOrderSubmitFlowStore((state) => state.execution);
  const { form, inputToken, outputToken, market, input: orderInput } = useOrderModel();
  const { address, chainId } = useConnection();
  const client = useClient();
  const wallet = useWalletInteractions();
  const queryClient = useQueryClient();
  const { handleCurrencyChange } = useActionHandlers();
  const walletBusy = useSyncExternalStore(subscribeSubmissionLock, isSubmissionBusy, () => false);
  const returnToReview = useCallback(() => {
    if (submissions.isBusy()) return;
    const { pendingWrappedInputAddress, pendingWrappedContext, setPendingWrappedInputAddress } = useOrderSubmitFlowStore.getState();
    if (pendingWrappedInputAddress && chainId && pendingWrappedContext?.chainId === chainId &&
        pendingWrappedContext.account.toLowerCase() === address?.toLowerCase() &&
        isNativeAddress(inputToken?.address ?? "")) {
      // Wrapping is 1:1, so retain the reviewed amount, prices and schedule.
      useSwapStore.getState().setOrderInput(
        getOrderDraftKey(chainId, form.module, pendingWrappedInputAddress, outputToken?.address),
        orderInput,
      );
      handleCurrencyChange(pendingWrappedInputAddress, Field.INPUT);
    }
    setPendingWrappedInputAddress(undefined);
    submissions.reset();
  }, [address, chainId, form.module, handleCurrencyChange, inputToken?.address, orderInput, outputToken?.address]);
  const detachSubmission = useCallback(() => {
    submissions.detach();
    useOrderSubmitFlowStore.getState().setPendingWrappedInputAddress(undefined);
  }, []);

  const submitOrder = useCallback(() => {
    const submit = async () => {
      let releaseWallet: (() => void) | undefined;
      let submission: ReturnType<typeof submissions.start> | undefined;
      let toastId: string | undefined;
      let executionError: string | undefined;
      let confirmedWrappedSymbol: string | undefined;
      try {
        if (submissions.isBusy())
          throw new SubmissionPreflightError(
            "An order is already being submitted. Wait for it to finish.",
          );
        if (!address || !chainId)
          throw new SubmissionPreflightError(
            "Connect a wallet before submitting an order.",
          );
        if (!client.data)
          throw new SubmissionPreflightError(
            "Order configuration is not ready. Wait for it to load or retry.",
          );
        if (!inputToken || !outputToken)
          throw new SubmissionPreflightError(
            "Select both tokens before submitting an order.",
          );
        if (market.isLoading)
          throw new SubmissionPreflightError(
            "Wait for market data before submitting an order.",
          );
        if (market.noLiquidity)
          throw new SubmissionPreflightError(
            "No liquidity is available for this token pair.",
          );
        if (market.error || !market.value)
          throw new SubmissionPreflightError(
            "A current Spot quote is required. Retry the quote before submitting.",
          );
        if (!form.canSubmit)
          throw new SubmissionPreflightError(
            "Resolve the order inputs before submitting.",
          );

        releaseWallet = acquireSubmissionLock();
        submission = submissions.start();
        const currentSubmission = submission;
        toastId = `${CREATE_ORDER_TOAST_ID}-${submission.id}`;
        const currentToastId = toastId;
        const wrappedNativeToken = getWrappedNativeCurrency(chainId);
        const amountSummary = `${form.inputAmount.ui} ${inputToken.symbol ?? "token"} → ${outputToken.symbol ?? "token"}`;
        const executor = createOrderExecutor((execution) => {
          // No wallet prompt remains once signing finishes. The next order may
          // start while this request is being accepted by the server.
          if (execution.phase === ExecutionPhase.SUBMITTING) {
            releaseWallet?.();
            releaseWallet = undefined;
          }
          currentSubmission.publish(execution);
          if (execution.phase === ExecutionPhase.WRAPPING && execution.currentStepIndex === 1 &&
              execution.wrapTxHash && wrappedNativeToken) {
            // Retain confirmed funds for this operation even after its review
            // closes. A late rejection must still explain how to use them.
            confirmedWrappedSymbol = wrappedNativeToken.symbol ?? "the wrapped token";
            if (currentSubmission.isCurrent()) {
              useOrderSubmitFlowStore.getState().setPendingWrappedInputAddress(wrappedNativeToken.address, {
                account: address,
                chainId,
              });
            }
          }
          if (execution.status === ExecutionStatus.LOADING) {
            const instruction = execution.phase === ExecutionPhase.SIGNING ? "Confirm the signature in your wallet."
              : execution.phase === ExecutionPhase.WRAPPING ? execution.wrapTxHash ? "Confirming wrapping…" : "Confirm wrapping in your wallet."
              : execution.phase === ExecutionPhase.APPROVING ? execution.approvalTxHash ? "Confirming approval…" : "Confirm approval in your wallet."
              : execution.phase === ExecutionPhase.SUBMITTING ? "Placing your order…"
              : "Checking token allowance…";
            toast.loading("Creating order…", { id: currentToastId, description: `${amountSummary}. ${instruction}` });
          } else if (execution.phase === ExecutionPhase.REJECTED) {
            if (!confirmedWrappedSymbol) toast.dismiss(currentToastId);
          } else if (execution.error) {
            executionError = execution.error.message;
          }
        });
        // Capture the form and wallet scope once, before the first wallet request.
        trackFunnel({ name: "submit_requested", product: "advanced" });
        const order = await executor.submit({
          client: client.data,
          wallet,
          account: address,
          form,
          inputToken,
          outputToken,
          wrappedNativeToken,
        });
        trackFunnel({ name: "submission_succeeded", product: "advanced" });
        useRecentOrder.getState().add(order);
        toast.success("Order placed", { id: currentToastId, description: amountSummary, duration: 8_000, closeButton: true });
        // A refresh failure must not turn an accepted order into a failed submission.
        void invalidateOrderQueries(queryClient, { partner: client.data.partner, chainId, account: address }).catch(() => undefined);
      } catch (error) {
        trackFunnel({ name: "submission_failed", product: "advanced" });
        const wrappedGuidance = confirmedWrappedSymbol
          ? `Your input was wrapped to ${confirmedWrappedSymbol}. Select ${confirmedWrappedSymbol} for your next order.`
          : undefined;
        if (isUserRejectedError(error) && !executionError) {
          if (wrappedGuidance) {
            toast.info("Order not placed", { id: toastId, description: wrappedGuidance, duration: 20_000, closeButton: true });
          } else if (toastId) {
            toast.dismiss(toastId);
          }
          return;
        }
        const message = executionError ?? (error instanceof Error ? error.message : String(error));
        toast.error("Order submission failed", {
          id: toastId,
          description: wrappedGuidance ? `${message} ${wrappedGuidance}` : message,
          duration: wrappedGuidance ? 20_000 : 8_000,
          closeButton: true,
        });
        // Execution errors already have a failed snapshot. Validation can fail
        // before execution starts, so publish it for the same inline error UI.
        if (error instanceof SubmissionPreflightError && !submissions.isBusy()) {
          useOrderSubmitFlowStore.setState({ execution: {
            phase: ExecutionPhase.FAILED,
            status: ExecutionStatus.FAILED,
            error: { message: error.message },
            form, inputToken, outputToken, chainId,
          } });
        }
      } finally {
        releaseWallet?.();
        submission?.complete();
      }
    };
    // Each submission reports its own outcome. It is never retried automatically.
    void submit();
  }, [address, chainId, client.data, form, inputToken, market, outputToken, queryClient, wallet]);
  const isSubmitting = snapshot.status === ExecutionStatus.LOADING;
  // Keep the executor's actual status intact. The view only decides which UI
  // to show, including a button loader while allowance is being checked.
  let view: SubmissionView = "review";
  if (snapshot.status === ExecutionStatus.SUCCESS) view = "success";
  else if (snapshot.status === ExecutionStatus.FAILED || snapshot.error) view = "failed";
  else if (isSubmitting && snapshot.phase !== ExecutionPhase.REJECTED) {
    view = snapshot.phase === ExecutionPhase.PREPARING || snapshot.phase === ExecutionPhase.IDLE
      ? "preparing" : "progress";
  }

  const reviewDisabled = isSubmitting || !address || !client.data || !inputToken || !outputToken ||
    !form.canSubmit || market.noLiquidity || market.isLoading || Boolean(market.error) || !market.value;
  return {
    ...snapshot,
    view,
    submitOrder,
    inputToken: snapshot.inputToken ?? inputToken,
    outputToken: snapshot.outputToken ?? outputToken,
    isSubmitting,
    reviewDisabled,
    submitDisabled: reviewDisabled || walletBusy,
    walletBusy,
    quoteLoading: client.isLoading || market.isLoading,
    returnToReview,
    detachSubmission,
  };
}

export type OrderExecution = ReturnType<typeof useOrderExecution>;
