import { OrderStatus, type Order } from "@orbs-network/spot-ui";

/** The service calls partial cancellations "partially_completed"; the SDK falls back to Expired. */
export function normalizeOrderStatus(order: Order): Order {
  if (order.version !== 2 || order.status !== OrderStatus.Expired || !("metadata" in order.rawOrder)) return order;
  const description = order.rawOrder.metadata.description ?? "";
  return /^\s*cancel(?:led|ed)\b/i.test(description)
    ? { ...order, status: OrderStatus.Cancelled }
    : order;
}
