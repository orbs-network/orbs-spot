"use client";
import { useCallback, useMemo, useRef } from "react";
import { toast } from "sonner";
import { useConnection } from "wagmi";
import TokensPair from "@/components/tokens-pair";
import { useDerivedSwap } from "@/lib/hooks/use-derived-swap";
import { getExplorerUrl, makeEllipsisAddress } from "@/lib/utils";
import { dismissTransactionRejectedToast } from "@/lib/tx-rejection";

type ToastId = string | number;

const getReadableSwapError = (error: unknown) => {
  if (!(error instanceof Error)) {
    return "Something went wrong while preparing the transaction.";
  }

  if (/^(Quote|Wallet|Swap confirmation)/.test(error.message)) return error.message;
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

export const useSwapToasts = () => {
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
              className="text-sm text-primary hover:underline"
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
            className="text-sm text-primary hover:underline"
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

