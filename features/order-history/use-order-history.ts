"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { OrderFilter } from "@orbs-network/spot-ui";
import { useConnection } from "wagmi";
import { bsc } from "viem/chains";
import { SPOT_CHAINS } from "@/lib/consts";
import { getChainName } from "@/lib/utils";
import { useDataChainId } from "@/lib/hooks/use-data-chain-id";
import { useOrders, useHistoryNotifications } from "@/components/advanced-order/use-order-client";
import { ORDER_HISTORY_CLOSE_RESET_DELAY, filterAndSortOrders } from "./format";
import { useOrderSelection } from "./use-order-selection";
import { useNetworkOrders } from "./use-network-orders";

/** Own history reads and navigation state independently of its table/modal markup. */
export function useOrderHistory(presentation: "page" | "modal", onOpenChange: (open: boolean) => void) {
  const { address } = useConnection();
  const chainId = useDataChainId();
  const chainName = chainId === bsc.id ? "BSC" : getChainName(chainId) || `Chain ${chainId}`;
  const singleNetwork = useOrders(presentation === "modal");
  const networks = useNetworkOrders(presentation === "page");
  const orders = presentation === "page" ? networks.data.orders : singleNetwork.data.all;
  useHistoryNotifications(orders);
  const [selectedFilter, setSelectedFilter] = useState<OrderFilter>(
    OrderFilter.All,
  );
  const [selectedOrderId, setSelectedOrderId] = useState<string>();
  const [selectedNetwork, setSelectedNetwork] = useState("all");
  const drawer = useOrderSelection(presentation === "page", chainId);
  const selectDrawerOrder = drawer.select;
  const ordersById = useMemo(() => new Map(orders.map(order => [order.historyKey, order])), [orders]);
  const selectOrder = useCallback((id: string, orderChainId: number) => {
    if (presentation === "page") selectDrawerOrder(id, orderChainId);
    else setSelectedOrderId(id);
  }, [presentation, selectDrawerOrder]);
  const visibleNetworks = SPOT_CHAINS.filter(chain => selectedNetwork === "all" || String(chain.id) === selectedNetwork);
  const failedNetworks = networks.data.failures.filter(failure => selectedNetwork === "all" || String(failure.chainId) === selectedNetwork);
  const loading = presentation === "page" ? networks.isLoading : singleNetwork.isLoading;
  const error = presentation === "page"
    ? networks.error ?? (failedNetworks.length === visibleNetworks.length ? failedNetworks[0]?.error : null)
    : singleNetwork.error;
  const refetch = presentation === "page" ? networks.refetch : singleNetwork.refetch;
  const selectedNetworkError = networks.data.failures.find(failure => failure.chainId === drawer.chainId)?.error;
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
  const paginationScope = `${presentation === "page" ? selectedNetwork : chainId}:${address?.toLowerCase() ?? ""}:${selectedFilter}`;
  const [pagination, setPagination] = useState({ scope: paginationScope, pageIndex: 0, pageSize: 10 });
  const lastPage = Math.max(0, Math.ceil(filteredOrders.length / pagination.pageSize) - 1);
  const pageIndex = pagination.scope === paginationScope ? Math.min(pagination.pageIndex, lastPage) : 0;
  // Reset when the wallet, network or filter changes; clamp if a refresh removes the last page.
  // Keep pagination here so returning from order details restores the selected page.
  if (pagination.scope !== paginationScope || pagination.pageIndex !== pageIndex) {
    setPagination({ ...pagination, scope: paginationScope, pageIndex });
  }
  // Store only the stable ID. Resolving against the latest unfiltered order
  // list keeps details in sync after cancellation or any background refetch.
  const activeOrderId = presentation === "page" ? drawer.orderId : selectedOrderId;
  const activeOrder = activeOrderId ? ordersById.get(activeOrderId) : undefined;
  const selectedOrder = activeOrder && (presentation !== "page" || activeOrder.chainId === drawer.chainId)
    ? activeOrder
    : undefined;
  const onPageChange = useCallback((pageIndex: number) => {
    setPagination(current => ({ ...current, pageIndex }));
  }, []);
  const onPageSizeChange = useCallback((pageSize: number) => {
    setPagination(current => ({ ...current, pageSize, pageIndex: 0 }));
  }, []);
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
    setSelectedOrderId, selectOrder, failedNetworks, loading, error, refetch,
    selectedNetworkError, filteredOrders, paginationScope, pageIndex,
    pageSize: pagination.pageSize, onPageChange, onPageSizeChange, handleOpenChange,
  };
}
