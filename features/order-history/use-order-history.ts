"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { OrderFilter } from "@orbs-network/spot-ui";
import { useConnection } from "wagmi";
import { bsc } from "viem/chains";
import { usePathname, useSearchParams } from "next/navigation";
import { updateUrlSearchParams } from "@/lib/url-state";
import { getChainName } from "@/lib/utils";
import { useDataChainId } from "@/lib/hooks/use-data-chain-id";
import { useOrders, useHistoryNotifications } from "@/components/advanced-order/use-order-client";
import { ORDER_HISTORY_CLOSE_RESET_DELAY, filterAndSortOrders, getPageHistoryFilter, type HistoryFilter } from "./format";
import { useOrderSelection } from "./use-order-selection";
import { useNetworkOrders } from "./use-network-orders";

/** Own history reads and navigation state independently of its table/modal markup. */
export function useOrderHistory(presentation: "page" | "modal", onOpenChange: (open: boolean) => void) {
  const { address, isConnecting, isReconnecting } = useConnection();
  const chainId = useDataChainId();
  const chainName = chainId === bsc.id ? "BSC" : getChainName(chainId) || `Chain ${chainId}`;
  const singleNetwork = useOrders(presentation === "modal");
  const networks = useNetworkOrders(presentation === "page");
  const orders = presentation === "page" ? networks.data : singleNetwork.data.all;
  useHistoryNotifications(orders);
  const [modalFilter, setModalFilter] = useState<OrderFilter>(
    OrderFilter.All,
  );
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const pageFilter = getPageHistoryFilter(searchParams.get("filter"));
  const selectedFilter = presentation === "page" ? pageFilter : modalFilter;
  const setSelectedFilter = useCallback((filter: HistoryFilter) => {
    if (presentation === "modal") {
      setModalFilter(filter === "history" ? OrderFilter.All : filter);
      return;
    }
    updateUrlSearchParams(pathname, searchParams, params => {
      if (filter === OrderFilter.Open) params.delete("filter");
      else params.set("filter", filter.toLowerCase());
    });
  }, [pathname, searchParams, presentation]);
  const [selectedOrderId, setSelectedOrderId] = useState<string>();
  const [selectedNetwork, setSelectedNetwork] = useState("all");
  const drawer = useOrderSelection(presentation === "page", chainId);
  const selectDrawerOrder = drawer.select;
  const ordersById = useMemo(() => new Map(orders.map(order => [order.historyKey, order])), [orders]);
  const selectOrder = useCallback((id: string, orderChainId: number) => {
    if (presentation === "page") selectDrawerOrder(id, orderChainId);
    else setSelectedOrderId(id);
  }, [presentation, selectDrawerOrder]);
  const loading = isConnecting || isReconnecting || (presentation === "page" ? networks.isLoading : singleNetwork.isLoading);
  const error = presentation === "page" ? networks.error : singleNetwork.error;
  const refetch = presentation === "page" ? networks.refetch : singleNetwork.refetch;
  const clearSelectedOrderTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearSelectedOrderTimer = useCallback(() => {
    if (!clearSelectedOrderTimerRef.current) return;
    clearTimeout(clearSelectedOrderTimerRef.current);
    clearSelectedOrderTimerRef.current = null;
  }, []);

  useEffect(() => clearSelectedOrderTimer, [clearSelectedOrderTimer]);

  const filteredOrders = useMemo(
    () => filterAndSortOrders(orders, selectedFilter).filter(order => presentation !== "page" || selectedNetwork === "all" || String(order.chainId) === selectedNetwork),
    [orders, selectedFilter, selectedNetwork, presentation],
  );
  const filterScope = `${presentation === "page" ? selectedNetwork : chainId}:${address?.toLowerCase() ?? ""}:${selectedFilter}`;
  // Store only the stable ID. Resolving against the latest unfiltered order
  // list keeps details in sync after cancellation or any background refetch.
  const activeOrderId = presentation === "page" ? drawer.orderId : selectedOrderId;
  const activeOrder = activeOrderId ? ordersById.get(activeOrderId) : undefined;
  const selectedOrder = activeOrder && (presentation !== "page" || activeOrder.chainId === drawer.chainId)
    ? activeOrder
    : undefined;
  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      onOpenChange(nextOpen);
      if (nextOpen) {
        clearSelectedOrderTimer();
        return;
      }

      clearSelectedOrderTimer();
      clearSelectedOrderTimerRef.current = setTimeout(() => {
        setSelectedOrderId(undefined);
        clearSelectedOrderTimerRef.current = null;
      }, ORDER_HISTORY_CLOSE_RESET_DELAY);
    },
    [clearSelectedOrderTimer, onOpenChange],
  );

  return {
    address, chainName, orders, networks, drawer, selectedOrder,
    selectedFilter, setSelectedFilter, selectedNetwork, setSelectedNetwork,
    setSelectedOrderId, selectOrder, loading, error, refetch,
    filteredOrders, filterScope, handleOpenChange,
  };
}
