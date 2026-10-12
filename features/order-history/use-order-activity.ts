"use client";

import { useMemo } from "react";
import type { Order } from "@orbs-network/spot-ui";
import { useRecentOrder } from "@/lib/spot/recent-order";
import { matchesOrderSearch, pairKey } from "./activity-model";
import { normalizeTimestamp } from "./format";
import { useActivityRows } from "./use-activity-rows";

/** Combine optimistic orders, cached metadata and local filters without refetching. */
export function useOrderActivity({ orders, allOrders = orders, search, view, network, pair = "all", address }: {
  orders: Order[];
  allOrders?: Order[];
  search: string;
  view: "open" | "history";
  network: string;
  pair?: string;
  address?: string;
}) {
  const recentPending = useRecentOrder(state => state.pending);
  const recentKey = useRecentOrder(state => state.key);
  const recentAccount = useRecentOrder(state => state.account);
  const pending = useMemo(() => {
    const indexed = new Set(allOrders.map(order => order.historyKey));
    return view === "open" ? recentPending.filter(order =>
      order.maker.toLowerCase() === address?.toLowerCase()
      && (network === "all" || String(order.chainId) === network)
      && !indexed.has(order.historyKey),
    ) : [];
  }, [recentPending, allOrders, view, address, network]);
  const pendingKeys = useMemo(() => new Set(pending.map(order => order.historyKey)), [pending]);
  const metadataOrders = useMemo(() => pending.length ? [...pending, ...allOrders] : allOrders, [pending, allOrders]);
  const { rows, isLoading: symbolsLoading, hasErrors: symbolErrors } = useActivityRows(metadataOrders);
  const visibleOrders = useMemo(() => new Set([...pendingKeys, ...orders.map(order => order.historyKey)]), [pendingKeys, orders]);
  const sorted = useMemo(() => rows.filter(row => visibleOrders.has(row.original.historyKey)
    && (pair === "all" || pairKey(row.original) === pair))
    .sort((a, b) => (normalizeTimestamp(b.original.createdAt) ?? 0) - (normalizeTimestamp(a.original.createdAt) ?? 0)
      || a.original.historyKey.localeCompare(b.original.historyKey)), [rows, visibleOrders, pair]);
  const query = search.trim();
  const filtered = useMemo(() => query ? sorted.filter(row => matchesOrderSearch(row.original, query)) : sorted, [sorted, query]);
  return { filtered, pendingKeys, recentKey, recentAccount, query, symbolsLoading, symbolErrors, hasOrders: visibleOrders.size > 0 };
}
