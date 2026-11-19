"use client";

import { useMutationState } from "@tanstack/react-query";
import { OrderStatus, type Order, type Partners } from "@orbs-network/spot-ui";
import { spotKeys } from "./queries";
import { useSpotPartner } from "@/lib/hooks/use-spot-partner";
import { useSpotApiUrl } from "@/lib/hooks/use-spot-api-url";
import type { HistoryOrder } from "./order-tokens";

/** Cancellation stays pending through the write and its history refresh. */
export function useOrderCancelling(order?: HistoryOrder, partnerOverride?: Partners, apiUrlOverride?: string) {
  const { partner: selectedPartner } = useSpotPartner();
  const partner = partnerOverride ?? selectedPartner;
  const selectedApiUrl = useSpotApiUrl();
  const apiUrl = apiUrlOverride ?? order?.apiUrl ?? selectedApiUrl;
  const pending = useMutationState({
    filters: {
      mutationKey: spotKeys.cancellation(partner, order?.chainId, order?.maker, order?.historyKey, apiUrl),
      exact: true,
      status: "pending",
    },
    select: () => true,
  });
  const batches = useMutationState({
    filters: { mutationKey: ["spot-bulk-cancellation", apiUrl, partner], status: "pending" },
    select: mutation => (mutation.state.variables as { orders: Order[] } | undefined)?.orders.some(item => item.historyKey === order?.historyKey && item.chainId === order?.chainId && item.maker.toLowerCase() === order?.maker.toLowerCase()) ?? false,
  });
  return order?.status === OrderStatus.Open && (pending.length > 0 || batches.some(Boolean));
}
