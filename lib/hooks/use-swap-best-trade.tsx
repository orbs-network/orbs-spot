import { OrderSettlementError, type Order, type Partners } from "@orbs-network/spot-ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { erc20Abi } from "viem";
import { useSignTypedDataPayload } from "./use-sign-typed-data";
import { useApproveToken } from "./use-token-approval";
import { useGetTokenAllowance } from "./use-token-allowance";
import { useWrapNativeToken } from "./use-wrap";
import { getWrappedNativeCurrency, isNativeAddress, toAmountUI } from "../utils";
import { useDerivedSwap } from "./use-derived-swap";
import { createSwapExecutor, QuoteUpdatedError, SwapSubmissionUncertainError } from "@/lib/swap/execution";
import { createSwapToasts } from "@/lib/swap/use-swap-toasts";
import { useBestTradeSwapStore, useSwapStore } from "./store";
import { SwapStatus, SwapStep, type BestTradeQuote, type Currency } from "../types";
import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { useConnection, usePublicClient, useWalletClient } from "wagmi";
import { isUserRejectedError } from "../tx-rejection";
import { getFillTransactionHash, useSwapActivity } from "@/lib/swap/activity";
import { spotSwapQuoteQueryOptions, SPOT_SWAP_QUOTE_KEY, MIN_SWAP_VALUE_USD } from "@/lib/swap/quotes";
import { spotClientQueryOptions, invalidateOrderQueries } from "@/lib/spot/queries";
import { useSpotPartner } from "./use-spot-partner";
import { useDeveloperMode } from "./use-developer-mode";
import { useUSDPrice } from "./use-usd-price";
import { trackFunnel } from "@/lib/funnel-analytics";
import { swapSubmissions } from "@/lib/swap/submissions";
import { acquireSubmissionLock, isSubmissionBusy, subscribeSubmissionLock } from "@/lib/spot/submission-lock";
import { toast } from "sonner";

const executor = createSwapExecutor();

type SwapAttempt = {
  id: string;
  account: `0x${string}`;
  chainId: number;
  partner: Partners;
  quote: BestTradeQuote;
  inputCurrency: Currency;
  outputCurrency: Currency;
  inputAmount: string;
  amount: string;
  signal: AbortSignal;
  releaseWalletLock: () => void;
  toasts: ReturnType<typeof createSwapToasts>;
  progress: Partial<ReturnType<typeof useBestTradeSwapStore.getState>>;
};

function publishAttempt(attempt: SwapAttempt, progress: SwapAttempt["progress"]) {
  Object.assign(attempt.progress, progress);
  if (swapSubmissions.isCurrent(attempt.id)) useBestTradeSwapStore.getState().updateStore(progress);
}

export const useSwapBestTrade = () => {
  const status = useBestTradeSwapStore(state => state.status);
  const currentStep = useBestTradeSwapStore(state => state.currentStep);
  const isPreparing = status === SwapStatus.LOADING && currentStep === undefined;
  const updateStore = useBestTradeSwapStore(state => state.updateStore);
  const resetStore = useBestTradeSwapStore(state => state.resetStore);
  const totalSteps = useBestTradeSwapStore(state => state.totalSteps);
  const currentStepIndex = useBestTradeSwapStore(state => state.currentStepIndex);
  const txHash = useBestTradeSwapStore(state => state.txHash);
  const { parsedInputAmount, inputCurrency, outputCurrency, inputAmount, trade } = useDerivedSwap();
  const { partner } = useSpotPartner();
  const { isDeveloperPlayground } = useDeveloperMode();
  const inputUsd = useUSDPrice({ token: inputCurrency?.address, amount: inputAmount });
  const { address: account, chainId } = useConnection();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();
  const getAllowance = useGetTokenAllowance();
  const { mutateAsync: approveToken } = useApproveToken();
  const { mutateAsync: wrapNative } = useWrapNativeToken();
  const { mutateAsync: signTypedData } = useSignTypedDataPayload();
  const isWalletBusy = useSyncExternalStore(subscribeSubmissionLock, isSubmissionBusy, () => false);

  useEffect(() => () => {
    const id = swapSubmissions.current();
    if (id) {
      swapSubmissions.detach(id);
      useSwapStore.getState().resumeQuotesFor(id);
    }
    resetStore();
  }, [resetStore]);

  const { mutate: swapBestTrade } = useMutation({
    retry: false,
    mutationFn: async (attempt: SwapAttempt) => {
      const toasts = attempt.toasts;
      const updateStore = (progress: SwapAttempt["progress"]) => publishAttempt(attempt, progress);
      const { account, chainId, partner, quote, inputCurrency, outputCurrency, inputAmount, amount, signal } = attempt;
      signal.throwIfAborted();
      await queryClient.cancelQueries({ queryKey: SPOT_SWAP_QUOTE_KEY });
      signal.throwIfAborted();
      if (!walletClient || !publicClient || publicClient.chain.id !== chainId) throw new Error("Connect your wallet to the selected network and review the swap again.");
      if (inputUsd.data === undefined || inputUsd.isError || inputUsd.data < MIN_SWAP_VALUE_USD) throw new Error(`Enter a swap worth at least $${MIN_SWAP_VALUE_USD} and wait for its USD price.`);
      const client = await queryClient.fetchQuery(spotClientQueryOptions(partner, chainId, isDeveloperPlayground));
      signal.throwIfAborted();
      const native = isNativeAddress(inputCurrency.address);
      const wrappedToken = getWrappedNativeCurrency(chainId)?.address;
      const inputToken = native ? wrappedToken : inputCurrency.address;
      if (!inputToken) throw new Error("Wrapped native currency is unavailable");
      const readTokenBalance = () => publicClient.readContract({ address: inputToken as `0x${string}`, abi: erc20Abi, functionName: "balanceOf", args: [account] });
      const onWalletSubmitted = () => updateStore({ isAwaitingWallet: false });
      updateStore({ review: { inputCurrency, outputCurrency, inputAmount, outputAmount: toAmountUI(quote.outAmount, outputCurrency.decimals), chainId, account } });
      return executor.execute({
        client, signal, releaseWalletLock: attempt.releaseWalletLock,
        intent: { account, chainId, amount, inputToken, originalInputToken: inputCurrency.address, outputToken: outputCurrency.address, native },
        quote,
        assertWallet: async () => {
          const [accounts, activeChain] = await Promise.all([walletClient.getAddresses(), walletClient.getChainId()]);
          if (activeChain !== chainId || accounts[0]?.toLowerCase() !== account.toLowerCase()) throw new Error("Wallet account or network changed. Review the swap again.");
        },
        hasAllowance: async () => BigInt(await getAllowance({ ownerAddress: account, tokenAddress: inputToken, spenderAddress: client.spenderAddress })) >= BigInt(amount),
        getWrappedBalance: async () => (await readTokenBalance()).toString(),
        hasInputBalance: async (wrapAmountRaw: string) => native
          ? (await publicClient.getBalance({ address: account })) >= BigInt(wrapAmountRaw)
          : (await readTokenBalance()) >= BigInt(amount),
        wrap: async amount => wrapNative({ amount, onSubmitted: wrapTxHash => {
          updateStore({ isAwaitingWallet: false, wrapTxHash });
          toasts.onWrapConfirming();
        } }),
        approve: async () => approveToken({ tokenAddress: inputToken, spenderAddress: client.spenderAddress, amount,
          onSubmitted: approvalTxHash => {
            updateStore({ isAwaitingWallet: false, approvalTxHash });
            toasts.onApproveConfirming();
          } }),
        refreshQuote: () => {
          const options = spotSwapQuoteQueryOptions(client, account, inputCurrency, outputCurrency, amount, quote.slippage, wrappedToken);
          const queryFn = options.queryFn;
          if (typeof queryFn !== "function") throw new Error("Spot quote request is unavailable");
          return queryClient.fetchQuery({ ...options, staleTime: 0, retry: false,
            queryFn: context => queryFn({ ...context, signal: AbortSignal.any([signal, context.signal]) }) });
        },
        sign: async ({ typedData, signerAddress }) => {
          const signature = await signTypedData({ domain: { ...typedData.domain }, types: typedData.types,
            primaryType: typedData.primaryType, message: { ...typedData.message }, account: signerAddress });
          onWalletSubmitted();
          return signature;
        },
        onPlan: steps => updateStore({ steps: steps.map(step => SwapStep[step]), totalSteps: steps.length }),
        onStep: (step, currentStepIndex) => {
          trackFunnel({ name: "wallet_step_requested", product: "swap", step: step === "WRAP" ? "wrap" : step === "APPROVE" ? "approve" : "sign" });
          updateStore({ currentStep: SwapStep[step], currentStepIndex, isAwaitingWallet: true });
          if (step === "WRAP") toasts.onWrapRequest();
          else if (step === "APPROVE") toasts.onApproveRequest();
          else toasts.onSwapRequest();
        },
        onWrapped: () => {
          updateStore({ confirmedWrappedInputAddress: inputToken });
          toasts.onWrapSuccess();
        },
        onApproved: () => toasts.onApproveSuccess(),
        onSubmitting: () => {
          useSwapStore.getState().resumeQuotesFor(attempt.id);
          toasts.onSwapConfirming();
        },
        onSubmitted: (order: Order) => {
          swapSubmissions.track(attempt.id, chainId, order.id);
          useSwapActivity.getState().add({ kind: "spot", orderId: order.id, order, account, chainId, inputAmount,
            inputSymbol: inputCurrency.symbol, outputSymbol: outputCurrency.symbol, createdAt: Date.now(), status: "pending" });
          updateStore({ orderId: order.id, order, isAwaitingWallet: false });
          void invalidateOrderQueries(queryClient, { partner, chainId, account });
          toasts.onSwapConfirming();
        },
      });
    },
    onSuccess: ({ order }, attempt) => {
      useSwapActivity.getState().settle(attempt.chainId, order.id, "confirmed", order);
      const txHash = getFillTransactionHash(order);
      trackFunnel({ name: "submission_succeeded", product: "swap" });
      attempt.toasts.onSwapSuccess(txHash, order);
      const review = attempt.progress.review;
      publishAttempt(attempt, { status: SwapStatus.SUCCESS, order, txHash,
        review: review ? { ...review, outputAmount: toAmountUI(order.dstAmountFilled, attempt.outputCurrency.decimals) } : review });
    },
    onError: (error, attempt) => {
      const toasts = attempt.toasts;
      const updateStore = (progress: SwapAttempt["progress"]) => publishAttempt(attempt, progress);
      const confirmedWrappedInputAddress = attempt.progress.confirmedWrappedInputAddress;
      if (error instanceof QuoteUpdatedError) {
        trackFunnel({ name: "price_update_shown", product: "swap" });
        const wrappedSymbol = getWrappedNativeCurrency(attempt.chainId)?.symbol ?? "the wrapped token";
        toasts.onSwapFailed(confirmedWrappedInputAddress
          ? new Error(`Quote changed after wrapping. Your input is now ${wrappedSymbol}. Select ${wrappedSymbol} for your next swap.`)
          : error);
        updateStore(confirmedWrappedInputAddress
          ? { status: SwapStatus.FAILED, isAwaitingWallet: false,
              error: { message: "The quote changed after wrapping. Return to review to use your wrapped tokens with a fresh quote." } }
          : { status: undefined, currentStep: undefined, isAwaitingWallet: false,
              quoteUpdate: { previous: error.previous, next: error.next } });
        return;
      }
      if (error instanceof OrderSettlementError && error.reason !== "aborted") {
        useSwapActivity.getState().settle(attempt.chainId, error.orderId, error.reason);
      }
      const accepted = attempt.progress.orderId;
      const message = accepted && !(error instanceof OrderSettlementError)
        ? "Swap status is uncertain. Check order history before retrying; the order may still fill."
        : error.message;
      if (isUserRejectedError(error) && !accepted && !(error instanceof SwapSubmissionUncertainError) && !confirmedWrappedInputAddress) {
        toasts.onTransactionRejected();
        updateStore({ status: undefined });
      } else {
        trackFunnel({ name: "submission_failed", product: "swap" });
        const recoverWrapped = confirmedWrappedInputAddress && !accepted && !(error instanceof SwapSubmissionUncertainError);
        const wrappedSymbol = getWrappedNativeCurrency(attempt.chainId)?.symbol ?? "the wrapped token";
        const failureMessage = recoverWrapped
          ? `${message} Your input was wrapped to ${wrappedSymbol}. Select ${wrappedSymbol} for your next swap.`
          : message;
        updateStore({ status: SwapStatus.FAILED,
          confirmedWrappedInputAddress: recoverWrapped ? confirmedWrappedInputAddress : undefined,
          error: { message: failureMessage,
            submissionUncertain: error instanceof SwapSubmissionUncertainError || (error instanceof OrderSettlementError && (error.reason === "unconfirmed" || error.reason === "aborted")) || Boolean(accepted && !(error instanceof OrderSettlementError)) } });
        toasts.onSwapFailed(new Error(failureMessage));
      }
    },
    onSettled: (_result, _error, attempt) => {
      publishAttempt(attempt, { isAwaitingWallet: false });
      attempt.releaseWalletLock();
      useSwapStore.getState().resumeQuotesFor(attempt.id);
      swapSubmissions.finish(attempt.id);
      void invalidateOrderQueries(queryClient, attempt);
    },
  });

  const onSwapBestTrade = useCallback(() => {
    if (executor.isBusy()) {
      toast.info("Confirm the pending wallet request before starting another submission.");
      return;
    }
    if (useBestTradeSwapStore.getState().status === SwapStatus.LOADING) return;
    if (!inputCurrency || !outputCurrency || !trade || !account || !chainId) return;
    const quote = useBestTradeSwapStore.getState().reviewedQuote ?? trade;
    const releaseWalletLock = acquireSubmissionLock();
    const abortController = new AbortController();
    const id = crypto.randomUUID();
    swapSubmissions.begin(id);
    useSwapStore.getState().pauseQuotesFor(id);
    const toasts = createSwapToasts({ id: `swap-${id}`, inputSymbol: inputCurrency.symbol,
      outputSymbol: outputCurrency.symbol, inputAmount, chainId });
    const review = { inputCurrency: { ...inputCurrency }, outputCurrency: { ...outputCurrency }, inputAmount,
      outputAmount: toAmountUI(quote.outAmount, outputCurrency.decimals), chainId, account };
    toasts.onPreparing();
    trackFunnel({ name: "submit_requested", product: "swap" });
    updateStore({ status: SwapStatus.LOADING, review, currentStep: undefined, steps: undefined,
      totalSteps: undefined, currentStepIndex: 0, txHash: undefined, orderId: undefined, order: undefined,
      wrapTxHash: undefined, confirmedWrappedInputAddress: undefined, approvalTxHash: undefined, quoteUpdate: undefined, error: undefined });
    swapBestTrade({ account, chainId, partner, quote: structuredClone(quote), inputCurrency: { ...inputCurrency },
      outputCurrency: { ...outputCurrency }, inputAmount, amount: parsedInputAmount, signal: abortController.signal,
      id, toasts, progress: { review }, releaseWalletLock });
  }, [account, chainId, inputAmount, inputCurrency, outputCurrency, parsedInputAmount, partner, swapBestTrade, trade, updateStore]);

  const reset = useCallback(() => {
    const id = swapSubmissions.current();
    if (id) {
      swapSubmissions.detach(id);
      useSwapStore.getState().resumeQuotesFor(id);
    }
    resetStore();
  }, [resetStore]);

  return useMemo(() => ({ onSwapBestTrade, status, isPreparing, isWalletBusy, totalSteps, currentStepIndex, txHash, reset }),
    [currentStepIndex, reset, status, isPreparing, isWalletBusy, onSwapBestTrade, totalSteps, txHash]);
};
