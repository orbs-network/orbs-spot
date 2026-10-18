"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { isAddress } from "viem";
import type { Order } from "@orbs-network/spot-ui";
import { SPOT_CHAINS } from "@/lib/consts";
import { getChainName } from "@/lib/utils";
import { useOrderPage } from "./use-order-page";

export type OrderPreviewOptions = {
  orderId?: string;
  order?: Order;
  chainId: number;
  hasWallet: boolean;
  loading: boolean;
  error: Error | null;
};

/** Resolve shared links and retain the last preview throughout its exit animation. */
export function useOrderPreview({ orderId, order, chainId, hasWallet, loading, error }: OrderPreviewOptions) {
  const supportedRequestedChain = SPOT_CHAINS.some(chain => chain.id === chainId);
  const params = useSearchParams();
  const account = params.get("account");
  const linkedAccount = account && isAddress(account) ? account : undefined;
  const linked = useOrderPage(chainId, orderId ?? "", linkedAccount, Boolean(orderId && supportedRequestedChain && !order));
  const currentPreview = {
    orderId,
    // History may have refreshed after a newly created order was supplied here.
    order: linked.order ?? order,
    chainId,
    loading: linkedAccount || linked.isFetched ? linked.isLoading : loading || linked.isLoading,
    error: error ?? linked.error,
    canRead: hasWallet || Boolean(linkedAccount) || Boolean(order ?? linked.order),
  };
  const [retainedPreview, setRetainedPreview] = useState(currentPreview);
  // Closing removes the URL selection immediately. Keep the entire rendered
  // state stable until Radix unmounts its content after the exit animation.
  // Update during render so switching/reopening orders never paints stale data.
  if (orderId && (
    retainedPreview.orderId !== orderId || retainedPreview.order !== currentPreview.order ||
    retainedPreview.chainId !== chainId || retainedPreview.loading !== currentPreview.loading ||
    retainedPreview.error !== currentPreview.error || retainedPreview.canRead !== currentPreview.canRead
  )) {
    setRetainedPreview(currentPreview);
  }
  const preview = orderId ? currentPreview : retainedPreview;
  const supportedChain = SPOT_CHAINS.some(chain => chain.id === preview.chainId);
  const chainName = getChainName(preview.chainId) || "Unknown network";

  return { preview, supportedChain, chainName, refetch: linked.refetch };
}
