"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { HistoryOrder } from "@/lib/spot/order-tokens";
import { useConnection } from "wagmi";
import { useRecentOrder } from "@/lib/spot/recent-order";
import { getActiveSpotPartner } from "@/lib/partners/spot";
import { spotOrdersQueryOptions } from "@/lib/spot/queries";

const EMPTY_ORDERS: HistoryOrder[] = [];

/** All networks share one wallet/exchange request; network filters are local. */
export function useNetworkOrders(enabled: boolean, linkedAccount?: string) {
  const { address } = useConnection();
  const account = linkedAccount ?? address;
  const queryClient = useQueryClient();
  const query = useQuery({
    ...spotOrdersQueryOptions(getActiveSpotPartner(), account, queryClient),
    enabled: enabled && Boolean(account),
  });
  const orders = query.data ?? EMPTY_ORDERS;
  useEffect(() => {
    useRecentOrder.getState().indexed(new Set(orders.map(order => order.historyKey)));
  }, [orders]);
  return {
    ...query,
    data: orders,
    isLoading: enabled && Boolean(account) && query.isPending,
  };
}
