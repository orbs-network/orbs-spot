"use client";

import { toast } from "sonner";
import type { Order } from "@orbs-network/spot-ui";
import { getExplorerUrl } from "@/lib/utils";
import { getOrderHref } from "@/lib/spot/order-link";
import { dismissTransactionRejectedToast } from "@/lib/tx-rejection";

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
export function createSwapToasts({ id, inputSymbol, outputSymbol, inputAmount, chainId }: {
  id: string;
  inputSymbol: string;
  outputSymbol: string;
  inputAmount: string;
  chainId: number;
}) {
  const pair = `${inputAmount} ${inputSymbol} for ${outputSymbol}`;
  const loading = (title: string, description?: string) => toast.loading(title, { id, description });
  return {
    dismissPendingToasts: () => toast.dismiss(id),
    onPreparing: () => loading(`Preparing swap of ${pair}…`),
    onWrapRequest: () => loading(`Wrapping ${inputSymbol}…`, "Confirm the transaction in your wallet."),
    onWrapConfirming: () => loading(`Wrapping ${inputSymbol}…`, "Waiting for confirmation…"),
    onWrapSuccess: () => loading(`Preparing swap of ${pair}…`),
    onApproveRequest: () => loading(`Approving ${inputSymbol}…`, "Confirm token spending in your wallet."),
    onApproveConfirming: () => loading(`Approving ${inputSymbol}…`, "Waiting for confirmation…"),
    onApproveSuccess: () => loading(`Preparing swap of ${pair}…`),
    onSwapRequest: () => loading(`Swapping ${pair}…`, "Confirm the signature in your wallet."),
    onSwapConfirming: () => loading(`Swapping ${pair}…`),
    onSwapSuccess: (txHash?: string, order?: Order) => {
      const href = txHash ? getExplorerUrl(chainId, txHash) : order ? getOrderHref(order) : undefined;
      toast.success(`Swapped ${pair}`, {
        id,
        description: href ? <a href={href} target={txHash ? "_blank" : undefined} rel={txHash ? "noopener noreferrer" : undefined} className="text-sm text-primary hover:underline">
          {txHash ? "View on explorer" : "View order details"}
        </a> : undefined,
        duration: 20_000,
        closeButton: true,
      });
    },
    onSwapFailed: (error: unknown) => toast.error(`Swap of ${pair} not completed`, {
      id, description: getReadableSwapError(error), duration: 12_000, closeButton: true,
    }),
    onTransactionRejected: () => {
      toast.dismiss(id);
      dismissTransactionRejectedToast({ id });
    },
  };
}
