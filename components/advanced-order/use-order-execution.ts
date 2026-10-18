"use client";
import { useRecentOrder } from "@/lib/spot/recent-order";
import { trackFunnel } from "@/lib/funnel-analytics";

import { toast } from "sonner";
import { CREATE_ORDER_TOAST_ID } from "./constants";
import { useConnection } from "wagmi";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { useCallback } from "react";
import { isNativeAddress } from "@orbs-network/spot-ui";
import { useActionHandlers } from "@/lib/hooks/use-action-handlers";
import { Field } from "@/lib/types";
import { getOrderDraftKey } from "@/lib/spot/form";

// This playground has one order form. Keep its executor across React renders
// so the submission lock survives UI updates. A host with
// multiple independent forms should create a separate executor for each form.
const executor = createOrderExecutor((execution) =>
  useOrderSubmitFlowStore.setState({ execution }),
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
  const returnToReview = useCallback(() => {
    if (executor.isBusy()) return;
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
    executor.reset();
  }, [address, chainId, form.module, handleCurrencyChange, inputToken?.address, orderInput, outputToken?.address]);
  // mutate is the button action; the executor publishes detailed progress/errors.
  // isPending tracks this invocation, while the shared snapshot tracks its phases.
  const { mutate: submitOrder, isPending } = useMutation({
    mutationFn: async () => {
      if (executor.isBusy())
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
      if (!form.canSubmit)
        throw new SubmissionPreflightError(
          "Resolve the order inputs before submitting.",
        );

      // Capture the form and wallet scope once, before the first wallet request.
      trackFunnel({ name: "submit_requested", product: "advanced" });
      const order = await executor.submit({
        client: client.data,
        wallet,
        account: address,
        form,
        inputToken,
        outputToken,
        wrappedNativeToken: getWrappedNativeCurrency(chainId),
      });
      return { order, partner: client.data.partner, chainId, account: address };
    },
    // Submission may have reached the server even when its response is lost.
    retry: false,
    onError: (error) => {
      trackFunnel({ name: "submission_failed", product: "advanced" });
      if (isUserRejectedError(error)) return;
      // Execution errors already have a failed snapshot. Validation can fail
      // before execution starts, so publish it for the same inline error UI.
      if (error instanceof SubmissionPreflightError && !executor.isBusy()) {
        useOrderSubmitFlowStore.setState({ execution: {
          phase: ExecutionPhase.FAILED,
          status: ExecutionStatus.FAILED,
          error: { message: error.message },
          form, inputToken, outputToken, chainId,
        } });
      }
    },
    onSuccess: (result) => {
      trackFunnel({ name: "submission_succeeded", product: "advanced" });
      useRecentOrder.getState().add(result.order);
      if (useOrderSubmitFlowStore.getState().isReviewOpen) {
        toast.dismiss(CREATE_ORDER_TOAST_ID);
      } else {
        toast.success("Order placed", { id: CREATE_ORDER_TOAST_ID });
      }
      // A refresh failure must not turn an accepted order into a failed submission.
      // Use the submitted wallet scope, even if the user has since switched accounts.
      void invalidateOrderQueries(queryClient, result);
    },
  });
  const isSubmitting = isPending || snapshot.status === ExecutionStatus.LOADING;
  // Keep the executor's actual status intact. The view only decides which UI
  // to show, including a button loader while allowance is being checked.
  let view: SubmissionView = "review";
  if (snapshot.status === ExecutionStatus.SUCCESS) view = "success";
  else if (snapshot.status === ExecutionStatus.FAILED || snapshot.error) view = "failed";
  else if (isSubmitting && snapshot.phase !== ExecutionPhase.REJECTED) {
    view = snapshot.phase === ExecutionPhase.PREPARING || snapshot.phase === ExecutionPhase.IDLE
      ? "preparing" : "progress";
  }

  return {
    ...snapshot,
    view,
    submitOrder,
    inputToken: snapshot.inputToken ?? inputToken,
    outputToken: snapshot.outputToken ?? outputToken,
    isSubmitting,
    submitDisabled: isSubmitting || !address || !client.data || !inputToken || !outputToken ||
      !form.canSubmit || market.noLiquidity || market.isLoading,
    quoteLoading: client.isLoading || market.isLoading,
    returnToReview,
  };
}

export type OrderExecution = ReturnType<typeof useOrderExecution>;
