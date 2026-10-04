"use client";
import { ExecutionPhase } from "@/lib/spot/execution";
import { useExecution } from "./use-order-execution";

export function useSubmitOrderExecution() {
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

