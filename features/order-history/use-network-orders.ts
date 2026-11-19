"use client";

import { useEffect } from "react";
import type { HistoryOrder } from "@/lib/spot/order-tokens";
import { useRecentOrder } from "@/lib/spot/recent-order";
import { useHistoryOrdersQuery } from "@/lib/hooks/use-history-orders-query";
import { useSpotApiUrl } from "@/lib/hooks/use-spot-api-url";

const EMPTY_ORDERS: HistoryOrder[] = [];

/** All networks share one wallet/exchange request; network filters are local. */
export function useNetworkOrders(enabled: boolean, linkedAccount?: string) {
  const apiUrl = useSpotApiUrl();
  const query = useHistoryOrdersQuery(enabled, linkedAccount);
  const orders = query.data ?? EMPTY_ORDERS;
  useEffect(() => {
    useRecentOrder.getState().indexed(new Set(orders.map(order => order.historyKey)), apiUrl);
  }, [orders, apiUrl]);
  return {
    ...query,
    data: orders,
  };
}
