import { permit2Address } from "@orbs-network/liquidity-hub-sdk";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSignEip } from "./use-sign-eip";
import { useApproval } from "./use-approval";
import { useWrap } from "./use-wrap";
import { getWrappedNativeCurrency, isNativeAddress } from "../utils";
import { toAmountUI } from "../utils";
import { useDerivedSwap } from "./use-derived-swap";
import { createSwapExecutor, QuoteUpdatedError } from "@/lib/swap/execution";
import { useSwapToasts } from "@/lib/swap/use-swap-toasts";
import { useLiquidityHub } from "./liquidity-hub";
import { useGetTransactionReceipt } from "./use-get-transaction-receipt";
import { useBestTradeSwapStore, useSwapStore } from "./store";
import { SwapStatus, SwapStep } from "../types";
import { useCallback, useMemo } from "react";
import { useConnection, useWalletClient } from "wagmi";
import { isUserRejectedError } from "../tx-rejection";
import { useSwapActivity } from "@/lib/swap/activity";
import { trackFunnel } from "@/lib/funnel-analytics";

const executor = createSwapExecutor();

export const useSwapBestTrade = () => {
  const status = useBestTradeSwapStore((state) => state.status);
  const currentStep = useBestTradeSwapStore((state) => state.currentStep);
  // No transaction step is published until wallet/quote/allowance checks finish.
  const isPreparing = status === SwapStatus.LOADING && currentStep === undefined;
  const updateStore = useBestTradeSwapStore((state) => state.updateStore);
  const onWalletSubmitted = useCallback(() => updateStore({ isAwaitingWallet: false }), [updateStore]);
  const onWrapSubmitted = useCallback((hash: `0x${string}`) => updateStore({ isAwaitingWallet: false, wrapTxHash: hash }), [updateStore]);
  const onApprovalSubmitted = useCallback((hash: `0x${string}`) => updateStore({ isAwaitingWallet: false, approvalTxHash: hash }), [updateStore]);
  const totalSteps = useBestTradeSwapStore((state) => state.totalSteps);
  const currentStepIndex = useBestTradeSwapStore(
    (state) => state.currentStepIndex
  );
  const resetStore = useBestTradeSwapStore((state) => state.resetStore);
  const txHash = useBestTradeSwapStore((state) => state.txHash);

  const { mutateAsync: signEip } = useSignEip();
  const { parsedInputAmount, inputCurrency, outputCurrency, inputAmount, trade, refetchTrade } = useDerivedSwap();
  const liquidityHubClient = useLiquidityHub();
  const setPauseQuote = useSwapStore((state) => state.setPauseQuote);
  const queryClient = useQueryClient();
  const getTransactionReceiptCallback = useGetTransactionReceipt();
  const { ensureAllowance, approve } = useApproval(
    permit2Address,
    inputCurrency?.address,
    parsedInputAmount,
    onApprovalSubmitted,
  );
  const { mutateAsync: wrap } = useWrap(onWrapSubmitted);
  const toasts = useSwapToasts();
  const { address: account, chainId } = useConnection();
  const { data: walletClient } = useWalletClient();

  const { mutate: swapBestTrade } = useMutation({
    onMutate: () => ({ account, chainId }),
    mutationFn: async () => {
      if (!inputCurrency || !outputCurrency || !trade || !account || !chainId || !walletClient) {
        throw new Error("Connect a wallet and request a quote before swapping");
      }
      toasts.dismissPendingToasts();
      const reviewedQuote = useBestTradeSwapStore.getState().reviewedQuote ?? trade.originalQuote;
      updateStore({ status: SwapStatus.LOADING, currentStepIndex: 0, review: { inputCurrency, outputCurrency, inputAmount, outputAmount: toAmountUI(reviewedQuote.outAmount, outputCurrency.decimals), chainId } });
      setPauseQuote(true);
      const native = isNativeAddress(inputCurrency.address);
      const inputToken = native ? getWrappedNativeCurrency(chainId)?.address : inputCurrency.address;
      if (!inputToken) throw new Error("Wrapped native currency is unavailable");
      return executor.execute({
        intent: { account, chainId, amount: parsedInputAmount, inputToken, outputToken: outputCurrency.address, native },
        quote: reviewedQuote,
        assertWallet: async () => {
          const [accounts, activeChain] = await Promise.all([walletClient.getAddresses(), walletClient.getChainId()]);
          if (activeChain !== chainId || accounts[0]?.toLowerCase() !== account.toLowerCase()) {
            throw new Error("Wallet account or network changed. Review the swap again.");
          }
        },
        hasAllowance: ensureAllowance,
        wrap,
        approve,
        refreshQuote: async () => (await refetchTrade({ throwOnError: true })).data?.originalQuote,
        sign: async (quote) => {
          const signature = await signEip(quote);
          onWalletSubmitted();
          return signature;
        },
        submit: (quote, signature) => liquidityHubClient.swap(quote, signature),
        confirm: getTransactionReceiptCallback,
        onPlan: steps => updateStore({ steps: steps.map(step => SwapStep[step]), totalSteps: steps.length }),
        onStep: (step, currentStepIndex) => {
          trackFunnel({ name: "wallet_step_requested", product: "swap", step: step === "WRAP" ? "wrap" : step === "APPROVE" ? "approve" : "sign" });
          updateStore({ currentStep: SwapStep[step], currentStepIndex, isAwaitingWallet: true });
          // The open modal owns progress; use toasts when it is closed.
          if (useBestTradeSwapStore.getState().isReviewOpen) {
            toasts.dismissPendingToasts();
            return;
          }
          if (step === "WRAP") toasts.onWrapRequest();
          else if (step === "APPROVE") toasts.onApproveRequest();
          else toasts.onSwapRequest();
        },
        onWrapped: () => {
          if (useBestTradeSwapStore.getState().isReviewOpen) toasts.dismissPendingToasts();
          else toasts.onWrapSuccess();
        },
        onApproved: () => {
          if (useBestTradeSwapStore.getState().isReviewOpen) toasts.dismissPendingToasts();
          else toasts.onApproveSuccess();
        },
        onSubmitted: txHash => {
          useSwapActivity.getState().add({ hash: txHash, account, chainId, inputAmount,
            inputSymbol: inputCurrency.symbol, outputSymbol: outputCurrency.symbol, createdAt: Date.now(), status: "pending" });
          updateStore({ txHash });
          if (!useBestTradeSwapStore.getState().isReviewOpen) toasts.onSwapConfirming(txHash);
        },
      });
    },
    onSuccess: ({ txHash }, _variables, scope) => {
      if (scope?.chainId) useSwapActivity.getState().settle(scope.chainId, txHash, "confirmed");
      trackFunnel({ name: "submission_succeeded", product: "swap" });
      if (useBestTradeSwapStore.getState().isReviewOpen) {
        toasts.dismissPendingToasts();
      } else {
        toasts.onSwapSuccess(txHash);
      }
      updateStore({ status: SwapStatus.SUCCESS });
    },
    onError: (error) => {
      if (error instanceof QuoteUpdatedError) {
        trackFunnel({ name: "price_update_shown", product: "swap" });
        toasts.dismissPendingToasts();
        updateStore({ status: undefined, currentStep: undefined, isAwaitingWallet: false,
          quoteUpdate: { previous: error.previous, next: error.next } });
        return;
      }
      if (process.env.NODE_ENV !== "production" && !isUserRejectedError(error)) {
        console.error(error);
      }

      if (isUserRejectedError(error)) {
        toasts.onTransactionRejected();
        updateStore({ status: undefined });
      } else {
        trackFunnel({ name: "submission_failed", product: "swap" });
        updateStore({ status: SwapStatus.FAILED, error: { message: error.message } });
        if (useBestTradeSwapStore.getState().isReviewOpen) toasts.dismissPendingToasts();
        else toasts.onSwapFailed(error);
      }
    },
    onSettled: (_result, _error, _variables, scope) => {
      onWalletSubmitted();
      setPauseQuote(false);
      // The wallet may change while a prompt is open. Refresh the submitted
      // account's balances, including after a confirmed wrap followed by rejection.
      if (scope?.account && scope.chainId) {
        void queryClient.invalidateQueries({
          queryKey: ["balances", scope.chainId, scope.account.toLowerCase()],
        }).catch(() => undefined);
      }
    },
  });

  const onSwapBestTrade = useCallback(() => {
    if (executor.isBusy() || useBestTradeSwapStore.getState().status === SwapStatus.LOADING) return;
    trackFunnel({ name: "submit_requested", product: "swap" });
    updateStore({ status: SwapStatus.LOADING, currentStep: undefined, steps: undefined,
      totalSteps: undefined, currentStepIndex: 0, txHash: undefined, wrapTxHash: undefined,
      approvalTxHash: undefined, quoteUpdate: undefined, error: undefined });
    swapBestTrade();
  }, [swapBestTrade, updateStore]);

  return useMemo(
    () => ({
      onSwapBestTrade,
      status,
      isPreparing,
      totalSteps,
      currentStepIndex,
      txHash,
      reset: resetStore,
    }),
    [currentStepIndex, resetStore, status, isPreparing, onSwapBestTrade, totalSteps, txHash]
  );
};
