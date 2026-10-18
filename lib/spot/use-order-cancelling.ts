"use client";

import { useMutationState } from "@tanstack/react-query";
import { OrderStatus, type Order } from "@orbs-network/spot-ui";
import { spotKeys } from "./queries";
import { useSpotPartner } from "@/lib/hooks/use-spot-partner";

/** Cancellation stays pending through the write and its history refresh. */
export function useOrderCancelling(order?: Order) {
  const { partner } = useSpotPartner();
  const pending = useMutationState({
    filters: {
      mutationKey: spotKeys.cancellation(partner, order?.chainId, order?.maker, order?.historyKey),
      exact: true,
      status: "pending",
    },
    select: () => true,
  });
  const batches = useMutationState({
    filters: { mutationKey: ["spot-bulk-cancellation"], status: "pending" },
    select: mutation => (mutation.state.variables as Order[] | undefined)?.some(item => item.historyKey === order?.historyKey && item.chainId === order?.chainId && item.maker.toLowerCase() === order?.maker.toLowerCase()) ?? false,
  });
  return order?.status === OrderStatus.Open && (pending.length > 0 || batches.some(Boolean));
}
