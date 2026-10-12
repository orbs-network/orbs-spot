"use client";

import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getOrderTokens, orderTokenCurrency, orderTokensQueryOptions, withOrderTokens, type HistoryOrder } from "@/lib/spot/order-tokens";

/** Indexed orders already carry metadata; only optimistic orders need enrichment. */
export function useActivityRows(orders: HistoryOrder[]) {
  const queryClient = useQueryClient();
  const tokens = useMemo(() => getOrderTokens(orders), [orders]);
  const needsMetadata = orders.some(order => !order.inputToken || !order.outputToken);
  const query = useQuery({
    ...orderTokensQueryOptions(queryClient, tokens),
    enabled: needsMetadata && tokens.length > 0,
  });
  const loading = needsMetadata && tokens.length > 0 && query.isPending;
  const enriched = useMemo(() => withOrderTokens(orders, query.data ?? []), [orders, query.data]);
  const rows = useMemo(() => enriched.map(order => ({
    original: order,
    inputToken: orderTokenCurrency(order.inputToken),
    outputToken: orderTokenCurrency(order.outputToken),
    inputLoading: loading && !order.inputToken,
    outputLoading: loading && !order.outputToken,
  })), [enriched, loading]);
  return {
    rows,
    isLoading: loading,
    hasErrors: query.isError || enriched.some(order => !order.inputToken?.symbol || !order.outputToken?.symbol),
  };
}

export type ActivityRow = ReturnType<typeof useActivityRows>["rows"][number];
