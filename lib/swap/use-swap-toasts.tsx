"use client";

import { toast } from "sonner";
import { OrderSettlementError, OrderStatus, type Order, type Partners, type Token } from "@orbs-network/spot-ui";
import { toAmountUI } from "@/lib/utils";
import { dismissTransactionRejectedToast } from "@/lib/tx-rejection";
import { TradeToastDetails, type ToastTransaction } from "@/components/ui/trade-toast-details";
import { getFillTransactionHash, resolveSwapSettlementOrder } from "./activity";
import { useSubmissionPreview } from "@/lib/submission-preview";
import { formatDisplayAmount } from "@/lib/token-display";
import { createLoadingToast } from "@/lib/loading-toast";

const getReadableSwapError = (error: unknown) => {
  if (!(error instanceof Error)) return "The swap could not be completed. Please try again.";
  if (/^(Quote|Wallet|Swap confirmation|Swap status)/.test(error.message) || /history|cancelled|expired|unconfirmed|tracking|wrapped/i.test(error.message)) return error.message;
  const message = error.message.toLowerCase();
  if (message.includes("quote")) return "The quote expired or could not be refreshed. Try again with a fresh quote.";
  if (message.includes("allowance") || message.includes("approval")) return "Token approval did not complete. Please try approving again.";
  if (message.includes("insufficient")) return "The wallet does not have enough balance for this swap.";
  if (message.includes("network") || message.includes("fetch")) return "Network request failed. Check your connection and try again.";
  return "The swap could not be completed. Please try again.";
};

/** Each submission owns a toast and immutable labels, independent of the next draft. */
export function createSwapToasts({ id, inputSymbol, outputSymbol, inputAmount, outputAmount, inputCurrency, outputCurrency, chainId, account, partner, minimumOutputAmount, publishToast = show => show(), publishSuccessToast = publishToast }: {
  id: string;
  inputSymbol: string;
  outputSymbol: string;
  inputAmount: string;
  outputAmount?: string;
  inputCurrency?: Token;
  outputCurrency?: Token;
  chainId: number;
  account?: string;
  partner?: Partners;
  minimumOutputAmount?: string;
  publishToast?: (show: () => void) => void;
  publishSuccessToast?: (show: () => void) => void;
}) {
  const input = { token: inputCurrency ? { ...inputCurrency } : { symbol: inputSymbol }, amount: inputAmount };
  const output = { token: outputCurrency ? { ...outputCurrency } : { symbol: outputSymbol }, amount: outputAmount };
  const outputDecimals = outputCurrency?.decimals;
  const transactions = new Map<string, string>();
  const loadingToast = createLoadingToast(id);
  let acceptedOrder: Order | undefined;
  const publishPreview = (title: string, status: "pending" | "success" | "error", message?: string, order?: Order) => {
    acceptedOrder = order ?? acceptedOrder;
    useSubmissionPreview.getState().upsert({ id, kind: "swap", title, status, message, input,
      output: status === "success" && order?.dstAmountFilled && outputDecimals !== undefined
        ? { ...output, amount: toAmountUI(order.dstAmountFilled, outputDecimals) } : output,
      chainId, account: account ?? acceptedOrder?.maker, partner, order: acceptedOrder,
      transactions: Array.from(transactions, ([label, hash]) => ({ label, hash })),
      details: minimumOutputAmount ? [{ label: "Minimum received", value: `${formatDisplayAmount(minimumOutputAmount)} ${outputSymbol}` }] : undefined,
    });
  };
  const rememberTransaction = (label: string, hash?: string) => {
    if (hash) transactions.set(label, hash);
  };
  const details = (message?: string, order?: Order) => <TradeToastDetails
    input={input}
    output={order?.dstAmountFilled && outputDecimals !== undefined
      ? { ...output, amount: toAmountUI(order.dstAmountFilled, outputDecimals) }
      : output}
    message={message}
    chainId={chainId}
    transactions={Array.from(transactions, ([label, hash]): ToastTransaction => ({ label, hash }))}
  />;
  const loading = (title: string, message?: string) => {
    publishPreview(title, "pending", message);
    publishToast(() => loadingToast.show(title, { description: details(message) }));
  };
  const success = (txHash?: string, order?: Order) => {
    rememberTransaction("Swap transaction", txHash ?? (order && getFillTransactionHash(order)));
    const hasActualOutput = Boolean(order?.dstAmountFilled) && outputDecimals !== undefined;
    publishPreview("Swap completed", "success", hasActualOutput || !outputAmount ? undefined : "Output amount is estimated.", order);
    publishSuccessToast(() => toast.success("Swap completed", {
      id,
      description: details(hasActualOutput || !outputAmount ? undefined : "Output amount is estimated.", order),
      duration: 20_000,
      closeButton: true,
    }));
  };
  return {
    dismissPendingToasts: () => publishToast(() => toast.dismiss(id)),
    onPreparing: () => loading("Preparing swap"),
    onWrapRequest: () => loading(`Wrapping ${inputSymbol}`, "Confirm the transaction in your wallet."),
    onWrapConfirming: (hash?: string) => {
      rememberTransaction("Wrap transaction", hash);
      loading(`Wrapping ${inputSymbol}`, "Waiting for confirmation");
    },
    onWrapSuccess: () => loading("Preparing swap"),
    onApproveRequest: () => loading(`Approving ${inputSymbol}`, "Confirm token spending in your wallet."),
    onApproveConfirming: (hash?: string) => {
      rememberTransaction("Approval transaction", hash);
      loading(`Approving ${inputSymbol}`, "Waiting for confirmation");
    },
    onApproveSuccess: () => loading("Preparing swap"),
    onSwapRequest: () => loading("Swap in progress", "Confirm the signature in your wallet."),
    onSwapConfirming: (order?: Order) => {
      acceptedOrder = order ?? acceptedOrder;
      rememberTransaction("Swap transaction", order && getFillTransactionHash(order));
      loading("Swap in progress");
    },
    onSwapSuccess: success,
    onSwapFailed: (error: unknown, order?: Order) => {
      order = resolveSwapSettlementOrder(order ?? acceptedOrder, error);
      if (order?.status === OrderStatus.Completed) {
        success(undefined, order);
        return;
      }
      rememberTransaction("Swap transaction", order && getFillTransactionHash(order));
      const expired = order?.status === OrderStatus.Expired || (!order && error instanceof OrderSettlementError && error.reason === "expired");
      const message = expired ? "Swap order expired before completion. Please try again with a new quote."
        : order?.status === OrderStatus.Cancelled ? "Swap order was cancelled." : getReadableSwapError(error);
      const title = order?.status === OrderStatus.Open ? "Swap status uncertain" : "Failed to swap";
      publishPreview(title, "error", message, order);
      publishToast(() => toast.error(title, {
        id, description: details(message), duration: 12_000, closeButton: true,
      }));
    },
    onTransactionRejected: () => {
      publishPreview("Swap not submitted", "error", "Request declined in your wallet.");
      publishToast(() => {
        if (transactions.size) toast.info("Swap not submitted", {
          id, description: details("Request declined in your wallet."), duration: 12_000, closeButton: true,
        });
        else dismissTransactionRejectedToast({ id });
      });
    },
  };
}
