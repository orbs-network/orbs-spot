import type { Order } from "@orbs-network/spot-ui";

/** Include the network and maker so bookmarks also work without a connected wallet. */
export function getOrderHref(order: Pick<Order, "chainId" | "historyKey" | "maker">): string {
  return `/orders?order=${encodeURIComponent(order.historyKey)}&orderChainId=${order.chainId}&account=${encodeURIComponent(order.maker.toLowerCase())}`;
}
