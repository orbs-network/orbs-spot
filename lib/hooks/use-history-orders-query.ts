"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useConnection } from "wagmi";
import { getActiveSpotPartner } from "@/lib/partners/spot";
import { spotOrdersQueryOptions } from "@/lib/spot/queries";
import { createMockOrders } from "@/lib/spot/mock-orders";
import type { HistoryOrder } from "@/lib/spot/order-tokens";

const EMPTY_ORDERS: HistoryOrder[] = [];

/** Append designer samples at the read boundary, keeping the wallet cache real. */
export function useHistoryOrdersQuery(enabled = true, linkedAccount?: string) {
  const { address } = useConnection();
  const account = linkedAccount ?? address;
  const mockOrders = useSearchParams().get("mockorders") === "true";
  const queryClient = useQueryClient();
  const query = useQuery({
    ...spotOrdersQueryOptions(getActiveSpotPartner(), account, queryClient),
    enabled: enabled && Boolean(account),
  });
  const samples = useMemo(() => mockOrders ? createMockOrders() : EMPTY_ORDERS, [mockOrders]);
  const data = useMemo(() => samples.length ? [...(query.data ?? EMPTY_ORDERS), ...samples] : query.data, [query.data, samples]);
  return { ...query, data, isLoading: enabled && Boolean(account) && query.isPending && !data?.length };
}
