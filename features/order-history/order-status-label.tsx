"use client";

import { OrderStatus, type Order } from "@orbs-network/spot-ui";
import { useOrderCancelling } from "@/lib/spot/use-order-cancelling";
import { getOrderStatusTitle } from "./format";

export function OrderStatusLabel({ order }: { order: Order }) {
  const isCancelling = useOrderCancelling(order);
  return (
    <span role="status" aria-live="polite" className="inline-flex items-center gap-1.5">
      {isCancelling ? "Cancelling…" : order.status === OrderStatus.Open && order.fills.length > 0 ? "Partially filled" : order.status === OrderStatus.Completed ? "Filled" : getOrderStatusTitle(order.status)}
    </span>
  );
}
