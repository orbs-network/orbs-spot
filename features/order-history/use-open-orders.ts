"use client";

import { useRecentOrder } from "@/lib/spot/recent-order";
import { useMemo } from "react";
import { OrderFilter } from "@orbs-network/spot-ui";
import { useConnection } from "wagmi";
import { filterAndSortOrders } from "./format";
import { useNetworkOrders } from "./use-network-orders";
import { useSpotApiUrl } from "@/lib/hooks/use-spot-api-url";
import { DEFAULT_SPOT_API_URL } from "@/lib/spot/api";

/** Navigation, the form and history all observe the same wallet-scoped query. */
export function useOpenOrders() {
  const { address, isConnected } = useConnection();
  const apiUrl = useSpotApiUrl();
  const query = useNetworkOrders(isConnected);
  const orders = useMemo(() => filterAndSortOrders(query.data, OrderFilter.Open), [query.data]);
  const pending = useRecentOrder(state => state.pending);
  const pendingOrders = useMemo(() => {
    const indexed = new Set(query.data.map(order => order.historyKey));
    return pending.filter(order => (order.apiUrl ?? DEFAULT_SPOT_API_URL) === apiUrl && order.maker.toLowerCase() === address?.toLowerCase() && !indexed.has(order.historyKey));
  }, [pending, query.data, address, apiUrl]);
  return { ...query, orders, pendingOrders, address, isConnected, count: orders.length + (isConnected ? pendingOrders.length : 0) };
}
