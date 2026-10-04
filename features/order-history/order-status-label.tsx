"use client";

import type { Order } from "@orbs-network/spot-ui";
import { Spinner } from "@/components/ui/spinner";
import { useOrderCancelling } from "@/lib/spot/use-order-cancelling";
import { getOrderStatusTitle } from "./format";

export function OrderStatusLabel({ order }: { order: Order }) {
  const isCancelling = useOrderCancelling(order);
  return (
    <span role="status" aria-live="polite" className="inline-flex items-center gap-1.5">
      {isCancelling && <Spinner aria-hidden="true" className="size-3.5 shrink-0 motion-reduce:animate-none" />}
      {isCancelling ? "Cancelling…" : getOrderStatusTitle(order.status)}
    </span>
  );
}
