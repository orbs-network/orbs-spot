"use client";

import { useRecentOrder } from "@/lib/spot/recent-order";
import { useMemo } from "react";
import { OrderFilter } from "@orbs-network/spot-ui";
import { useConnection } from "wagmi";
import { filterAndSortOrders } from "./format";
import { useNetworkOrders } from "./use-network-orders";

/** Navigation, the form and history all observe the same wallet-scoped query. */
export function useOpenOrders() {
  const { address, isConnected } = useConnection();
  const query = useNetworkOrders(isConnected);
  const orders = useMemo(() => filterAndSortOrders(query.data, OrderFilter.Open), [query.data]);
  const pending = useRecentOrder(state => state.pending);
  const pendingOrders = useMemo(() => {
    const indexed = new Set(query.data.map(order => order.historyKey));
    return pending.filter(order => order.maker.toLowerCase() === address?.toLowerCase() && !indexed.has(order.historyKey));
  }, [pending, query.data, address]);
  return { ...query, orders, pendingOrders, address, isConnected, count: isConnected ? orders.length + pendingOrders.length : 0 };
}
