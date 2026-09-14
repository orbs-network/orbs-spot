import {
  isFreshQuote,
  permit2Address,
  Quote,
} from "@orbs-network/liquidity-hub-sdk";
import { useMutation } from "@tanstack/react-query";
import { useSignEip } from "./use-sign-eip";
import { useApproval } from "./use-approval";
import { useWrap } from "./use-wrap";
import { getExplorerUrl, isNativeAddress, makeEllipsisAddress } from "../utils";
import { useDerivedSwap } from "./use-derived-swap";
import BN from "bignumber.js";
import { useLiquidityHub } from "./liquidity-hub";
import { useGetTransactionReceiptCallback } from "./use-get-transaction-receipt";
import { useBestTradeSwapStore, useSwapStore } from "./store";
import { SwapStatus } from "@orbs-network/swap-ui";
import { SwapStep } from "../types";
import { toast } from "sonner";
import { useBalances } from "./use-balances";
import { useCallback, useMemo, useRef } from "react";
import TokensPair from "@/components/tokens-pair";
import { useConnection } from "wagmi";
import {
  isUserRejectedError,
  dismissTransactionRejectedToast,
} from "../tx-rejection";

const usePrepareQuote = () => {
  const { trade, refetchTrade } = useDerivedSwap();

  return useMutation({
    mutationFn: async () => {
      if (!trade) {
        throw new Error("Quote not found");
      }
      const originalQuote = trade.originalQuote as Quote;
      
      if (isFreshQuote(originalQuote, 60)) {
        return originalQuote;
      }
      const freshQuote = (await refetchTrade())?.data?.originalQuote as Quote | undefined;
      if (!freshQuote) {
        return originalQuote;
      }
      if (BN(freshQuote.minAmountOut).lt(BN(originalQuote.minAmountOut))) {
        return originalQuote;
      }
      return freshQuote;
    },
  });
};

const getTotalSteps = (shouldWrap: boolean, shouldApprove: boolean) => {
  let totalSteps = 1;
  if (shouldWrap) {
    totalSteps++;
  }
  if (shouldApprove) {
    totalSteps++;
  }
  return totalSteps;
};

type ToastId = string | number;

const getReadableSwapError = (error: unknown) => {
  if (!(error instanceof Error)) {
    return "Something went wrong while preparing the transaction.";
  }

  const message = error.message.toLowerCase();

  if (message.includes("quote")) {
    return "The quote expired or could not be refreshed. Try again with a fresh quote.";
  }
  if (message.includes("allowance") || message.includes("approval")) {
    return "Token approval did not complete. Please try approving again.";
  }
  if (message.includes("insufficient")) {
    return "The wallet does not have enough balance for this swap.";
  }
  if (message.includes("network") || message.includes("fetch")) {
    return "Network request failed. Check your connection and try again.";
  }

  return "The transaction could not be completed. Please try again.";
};

const useToasts = () => {
  const wrapToastId = useRef<ToastId | undefined>(undefined);
  const approveToastId = useRef<ToastId | undefined>(undefined);
  const swapToastId = useRef<ToastId | undefined>(undefined);
  const activeToastId = useRef<ToastId | undefined>(undefined);
  const { inputCurrency, outputCurrency } = useDerivedSwap();
  const { chainId } = useConnection();

  const dismissPendingToasts = useCallback(() => {
    for (const id of [
      wrapToastId.current,
      approveToastId.current,
      swapToastId.current,
    ]) {
      if (id) toast.dismiss(id);
    }
    wrapToastId.current = undefined;
    approveToastId.current = undefined;
    swapToastId.current = undefined;
    activeToastId.current = undefined;
  }, []);

  const onWrapRequest = useCallback(() => {
    wrapToastId.current = toast.loading(
      `Wrapping ${inputCurrency?.symbol ?? "token"}…`,
      {
        description: "Confirm the wrap transaction in your wallet.",
      }
    );
    activeToastId.current = wrapToastId.current;
  }, [inputCurrency?.symbol]);

  const onWrapSuccess = useCallback(() => {
    const id = wrapToastId.current;
    toast.success(`Wrapped ${inputCurrency?.symbol ?? "token"}`, {
      id,
      description: "Funds are ready for the swap.",
      duration: 4_000,
    });
    activeToastId.current = undefined;
  }, [inputCurrency?.symbol]);

  const onApproveRequest = useCallback(() => {
    approveToastId.current = toast.loading(
      `Approving ${inputCurrency?.symbol ?? "token"}…`,
      {
        description: "Confirm token spending in your wallet.",
      }
    );
    activeToastId.current = approveToastId.current;
  }, [inputCurrency?.symbol]);

  const onApproveSuccess = useCallback(() => {
    const id = approveToastId.current;
    toast.success(`Approved ${inputCurrency?.symbol ?? "token"}`, {
      id,
      description: "Approval confirmed.",
      duration: 4_000,
    });
    activeToastId.current = undefined;
  }, [inputCurrency?.symbol]);

  const onSwapRequest = useCallback(() => {
    swapToastId.current = toast.loading(
      <TokensPair
        prefix="Swapping"
        srcTokenAddress={inputCurrency?.address}
        dstTokenAddress={outputCurrency?.address}
      />
    );
    activeToastId.current = swapToastId.current;
  }, [inputCurrency?.address, outputCurrency?.address]);

  const onSwapConfirming = useCallback(
    (txHash: `0x${string}`) => {
      const explorerUrl = getExplorerUrl(chainId, txHash);
      const transactionText = `Transaction ${makeEllipsisAddress(txHash, {
        start: 8,
        end: 6,
      })}`;

      toast.loading(
        <TokensPair
          prefix="Confirming"
          srcTokenAddress={inputCurrency?.address}
          dstTokenAddress={outputCurrency?.address}
        />,
        {
          id: swapToastId.current,
          description: explorerUrl ? (
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-500 hover:text-blue-600"
            >
              {transactionText}
            </a>
          ) : (
            transactionText
          ),
        }
      );
    },
    [chainId, inputCurrency?.address, outputCurrency?.address]
  );

  const onSwapSuccess = useCallback((txHash: `0x${string}`) => {
    toast.success(
      <TokensPair
        prefix="Swap completed"
        srcTokenAddress={inputCurrency?.address}
        dstTokenAddress={outputCurrency?.address}
      />,
      {
        id: swapToastId.current,
        description: (
          <a
            href={getExplorerUrl(chainId, txHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-500 hover:text-blue-600"
          >
            View on explorer
          </a>
        ),
        duration: 20_000,
        closeButton: true,
      }
    );
    activeToastId.current = undefined;
  }, [inputCurrency?.address, outputCurrency?.address, chainId]);

  const onSwapFailed = useCallback((error: unknown) => {
    const id = activeToastId.current ?? swapToastId.current;
    dismissPendingToasts();
    toast.error("Swap failed", {
      id,
      description: getReadableSwapError(error),
      duration: 8_000,
      closeButton: true,
    });
    activeToastId.current = undefined;
  }, [dismissPendingToasts]);

  const onTransactionRejected = useCallback(() => {
    const id = activeToastId.current ?? swapToastId.current;
    dismissPendingToasts();
    dismissTransactionRejectedToast({
      id,
    });
    activeToastId.current = undefined;
  }, [dismissPendingToasts]);

  return useMemo(
    () => ({
      dismissPendingToasts,
      onWrapRequest,
      onApproveRequest,
      onSwapRequest,
      onSwapConfirming,
      onSwapSuccess,
      onApproveSuccess,
      onWrapSuccess,
      onSwapFailed,
      onTransactionRejected,
    }),
    [
      dismissPendingToasts,
      onApproveRequest,
      onApproveSuccess,
      onSwapConfirming,
      onSwapFailed,
      onSwapRequest,
      onSwapSuccess,
      onTransactionRejected,
      onWrapRequest,
      onWrapSuccess,
    ]
  );
};

export const useSwapBestTrade = () => {
  const { mutateAsync: prepareQuote } = usePrepareQuote();
  const status = useBestTradeSwapStore((state) => state.status);
  const updateStore = useBestTradeSwapStore((state) => state.updateStore);
  const totalSteps = useBestTradeSwapStore((state) => state.totalSteps);
  const currentStepIndex = useBestTradeSwapStore(
    (state) => state.currentStepIndex
  );
  const resetStore = useBestTradeSwapStore((state) => state.resetStore);
  const txHash = useBestTradeSwapStore((state) => state.txHash);

  const { mutateAsync: signEip } = useSignEip();
  const { parsedInputAmount, inputCurrency, outputCurrency } = useDerivedSwap();
  const liquidityHubClient = useLiquidityHub();
  const setPauseQuote = useSwapStore((state) => state.setPauseQuote);
  const { refetch: refetchBalances } = useBalances();
  const { mutateAsync: getTransactionReceiptCallback } =
    useGetTransactionReceiptCallback();
  const { ensureAllowance, approve } = useApproval(
    permit2Address,
    inputCurrency?.address,
    parsedInputAmount
  );
  const { mutateAsync: wrap } = useWrap();
  const toasts = useToasts();

  const { mutateAsync: swapBestTrade } = useMutation({
    mutationFn: async () => {
      if (!inputCurrency || !outputCurrency) {
        throw new Error("Input or output currency not found");
      }
      toasts.dismissPendingToasts();
      resetStore();
      let currentStepIndex = 0;
      updateStore({ status: SwapStatus.LOADING, currentStepIndex });
      setPauseQuote(true);

      const isNativeIn = isNativeAddress(inputCurrency.address);

      const hasAllowance = await ensureAllowance();
      updateStore({ totalSteps: getTotalSteps(isNativeIn, !hasAllowance) });

      if (isNativeIn) {
        updateStore({ currentStep: SwapStep.WRAP });

        toasts.onWrapRequest();
        await wrap(parsedInputAmount);
        toasts.onWrapSuccess();
        currentStepIndex++;
        updateStore({ currentStepIndex });
      }

      if (!hasAllowance) {
        updateStore({ currentStep: SwapStep.APPROVE });
        toasts.onApproveRequest();
        await approve();
        toasts.onApproveSuccess();
        currentStepIndex++;
        updateStore({ currentStepIndex });
      }

      updateStore({ currentStep: SwapStep.SWAP });
      const quote = await prepareQuote();
      toasts.onSwapRequest();
      const signature = await signEip(quote);
      const tx = await liquidityHubClient.swap(quote, signature);
      const txHash = tx as `0x${string}`;
      updateStore({ txHash });
      toasts.onSwapConfirming(txHash);
      const receipt = await getTransactionReceiptCallback(txHash);
      return { receipt, txHash };
    },
    onSuccess: ({ txHash }) => {
      toasts.onSwapSuccess(txHash);
      updateStore({ status: SwapStatus.SUCCESS });
    },
    onError: (error) => {
      if (process.env.NODE_ENV !== "production" && !isUserRejectedError(error)) {
        console.error(error);
      }
    
      if (isUserRejectedError(error)) {
        toasts.onTransactionRejected();
        updateStore({ status: undefined });
      } else {
        updateStore({ status: SwapStatus.FAILED });
        toasts.onSwapFailed(error);
      }
    },
    onSettled: () => {
      setPauseQuote(false);
      refetchBalances();
    },
  });

  return useMemo(
    () => ({
      onSwapBestTrade: swapBestTrade,
      status,
      totalSteps,
      currentStepIndex,
      txHash,
      reset: resetStore,
    }),
    [currentStepIndex, resetStore, status, swapBestTrade, totalSteps, txHash]
  );
};
