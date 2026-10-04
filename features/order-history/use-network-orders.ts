"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useConnection } from "wagmi";
import { SPOT_CHAINS } from "@/lib/consts";
import { getActiveSpotPartner } from "@/lib/partners/spot";

import { shareOrders, spotClientQueryOptions, spotKeys, type NetworkOrders } from "@/lib/spot/queries";

const EMPTY_NETWORK_ORDERS: NetworkOrders = { orders: [], failures: [] };

/** One history query; failed networks do not discard successful results. */
export function useNetworkOrders(enabled: boolean) {
  const { address } = useConnection();
  const partner = getActiveSpotPartner();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: spotKeys.orders(partner, "all", address),
    enabled: enabled && Boolean(address),
    queryFn: async ({ signal }): Promise<NetworkOrders> => {
      if (!address) throw new Error("Connect a wallet to load order history");
      signal.throwIfAborted();
      const results = await Promise.allSettled(SPOT_CHAINS.map(async chain => {
        const client = await queryClient.fetchQuery(spotClientQueryOptions(partner, chain.id, true));
        signal.throwIfAborted();
        return client.getAccountOrders({ account: address, signal, getv1orders: false });
      }));
      // An abandoned request is cancellation, not a failed-network result.
      signal.throwIfAborted();
      const data: NetworkOrders = { orders: [], failures: [] };
      results.forEach((result, index) => {
        if (result.status === "fulfilled") data.orders.push(...result.value);
        else data.failures.push({
          chainId: SPOT_CHAINS[index].id,
          error: result.reason instanceof Error ? result.reason : new Error(String(result.reason)),
        });
      });
      return data;
    },
    staleTime: 5_000,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    retry: false,
    structuralSharing: (previous: unknown, next: unknown) => {
      const oldData = previous as NetworkOrders | undefined;
      const newData = next as NetworkOrders;
      return {
        ...newData,
        orders: shareOrders(oldData?.orders, newData.orders),
      };
    },
  });
  return { ...query, data: query.data ?? EMPTY_NETWORK_ORDERS };
}
