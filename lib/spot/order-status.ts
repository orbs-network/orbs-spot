import { OrderStatus, type Order } from "@orbs-network/spot-ui";

/** Preserve the service's partial cancellation descriptions alongside the SDK's terminal statuses. */
export function normalizeOrderStatus(order: Order): Order {
  if (order.version !== 2 || !("metadata" in order.rawOrder)) return order;
  const serviceStatus = typeof order.rawOrder.metadata.status === "string" ? order.rawOrder.metadata.status.trim().toLowerCase() : "";
  if (order.status !== OrderStatus.Expired && !(order.status === OrderStatus.Open && serviceStatus === "partially_completed")) return order;
  const description = order.rawOrder.metadata.description ?? "";
  return /^\s*cancel(?:led|ed)\b/i.test(description)
    ? { ...order, status: OrderStatus.Cancelled }
    : order;
}
