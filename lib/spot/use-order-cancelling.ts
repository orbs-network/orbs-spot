"use client";

import { useMutationState } from "@tanstack/react-query";
import { OrderStatus, type Order } from "@orbs-network/spot-ui";
import { getActiveSpotPartner } from "@/lib/partners/spot";
import { spotKeys } from "./queries";

/** Cancellation stays pending through the write and its history refresh. */
export function useOrderCancelling(order?: Order) {
  const pending = useMutationState({
    filters: {
      mutationKey: spotKeys.cancellation(getActiveSpotPartner(), order?.chainId, order?.maker, order?.historyKey),
      exact: true,
      status: "pending",
    },
    select: () => true,
  });
  return order?.status === OrderStatus.Open && pending.length > 0;
}
