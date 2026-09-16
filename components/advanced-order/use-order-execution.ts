"use client";

import { toast } from "sonner";
import { CREATE_ORDER_TOAST_ID } from "./constants";
import { useConnection } from "wagmi";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useOrderSubmitFlowStore } from "@/lib/hooks/store";
import { getWrappedNativeCurrency } from "@/lib/utils";
import {
  createOrderExecutor,
  ExecutionPhase,
  ExecutionStatus,
} from "@/lib/spot/execution";
import { useOrderModel } from "./use-order-form";
import { useClient } from "./use-order-client";
import { useWalletInteractions } from "./hooks";

// This playground has one order form. Keep its executor across React renders
// so the submission lock and confirmed wrapping survive UI updates. A host with
// multiple independent forms should create a separate executor for each form.
const executor = createOrderExecutor((execution) =>
  useOrderSubmitFlowStore.setState({ execution }),
);

// Preflight errors belong to the review UI; executor errors already have a phase snapshot.
class SubmissionPreflightError extends Error {}

export function useSubmitButton() {
  const { form, inputToken, outputToken, market } = useOrderModel();
  const { address } = useConnection();
  const client = useClient();
  const isExecuting = useOrderSubmitFlowStore(
    (state) => state.execution.status === ExecutionStatus.LOADING,
  );
  return {
    disabled:
      isExecuting ||
      !address ||
      !client.data ||
      !inputToken ||
      !outputToken ||
      !form.canSubmit ||
      market.noLiquidity ||
      market.isLoading,
    loading: client.isLoading || market.isLoading,
  };
}

// React adapter: gather current inputs here; keep the wallet/SDK sequence in lib/spot.
export function useExecution() {
  const snapshot = useOrderSubmitFlowStore((state) => state.execution);
  const { form, inputToken, outputToken, market } = useOrderModel();
  const { address, chainId } = useConnection();
  const client = useClient();
  const wallet = useWalletInteractions();
  const queryClient = useQueryClient();
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
      if (error instanceof SubmissionPreflightError) {
        toast.error("Order not submitted", {
          id: CREATE_ORDER_TOAST_ID,
          description: error.message,
        });
      }
    },
    onSuccess: (result) => {
      toast.success("Order placed", { id: CREATE_ORDER_TOAST_ID });
      // A refresh failure must not turn an accepted order into a failed submission.
      // Use the submitted wallet scope, even if the user has since switched accounts.
      void Promise.allSettled([
        queryClient.invalidateQueries({
          queryKey: ["balances", result.chainId, result.account.toLowerCase()],
        }),
        queryClient.invalidateQueries({
          queryKey: [
            "spot-orders",
            result.partner,
            result.chainId,
            result.account.toLowerCase(),
          ],
        }),
      ]);
    },
  });
  return {
    ...snapshot,
    submitOrder,
    inputToken: snapshot.inputToken ?? inputToken,
    outputToken: snapshot.outputToken ?? outputToken,
    isExecuting: isPending || snapshot.status === ExecutionStatus.LOADING,
    isRejected: snapshot.phase === ExecutionPhase.REJECTED,
    startNewOrder: executor.reset,
    returnToOrderForm: executor.reset,
  };
}
