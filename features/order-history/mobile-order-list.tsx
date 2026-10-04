"use client";

import { useCallback, useContext } from "react";
import { Virtuoso } from "react-virtuoso";
import type { Order } from "@orbs-network/spot-ui";
import { HistoryPresentation } from "./presentation";
import { MobileOrderCard } from "./mobile-order-card";

const orderKey = (_: number, order: Order) => order.historyKey;

export function MobileOrderList({ orders, onSelect, children }: {
  orders: Order[];
  onSelect: (id: string, chainId: number) => void;
  children?: React.ReactNode;
}) {
  const presentation = useContext(HistoryPresentation);
  const itemContent = useCallback((index: number, order: Order) => (
    <div role="article" aria-label={`Order ${index + 1} of ${orders.length}`} className="pb-3">
      <MobileOrderCard order={order} onSelect={onSelect} />
    </div>
  ), [orders.length, onSelect]);

  return (
    <div data-mobile-order-list className="min-w-0">
      {orders.length ? (
        <>
          <p role="status" className="px-4 py-3 text-xs text-muted-foreground">
            {orders.length} {orders.length === 1 ? "order" : "orders"}
          </p>
          <Virtuoso
            useWindowScroll={presentation === "page"}
            className={presentation === "page" ? "w-full" : "h-[60dvh]"}
            data={orders}
            computeItemKey={orderKey}
            increaseViewportBy={300}
            aria-label="Order history"
            itemContent={itemContent}
          />
        </>
      ) : <div data-history-empty>{children}</div>}
    </div>
  );
}
