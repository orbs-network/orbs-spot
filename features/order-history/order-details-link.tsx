import type { ReactNode } from "react";
import type { Order } from "@orbs-network/spot-ui";

export function OrderDetailsLink({ order, onSelect, children, className, "aria-label": label }: {
  order: Order;
  onSelect: (id: string, chainId: number) => void;
  children: ReactNode;
  className: string;
  "aria-label": string;
}) {
  const props = { "data-order-details-trigger": true, "aria-label": label, className, children };
  return <button {...props} type="button" onClick={() => onSelect(order.historyKey, order.chainId)} />;
}
