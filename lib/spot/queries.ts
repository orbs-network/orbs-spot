import { createClient, getOrders } from "@orbs-network/spot-ui";
import { queryOptions, replaceEqualDeep, type QueryClient } from "@tanstack/react-query";
import { getOrderTokens, orderTokensQueryOptions, withOrderTokens, type HistoryOrder } from "./order-tokens";

type Partner = Parameters<typeof createClient>[0];

export type OrderQueryScope = { partner: Partner; chainId: number; account: string };

export const spotKeys = {
  cancellation: (partner: Partner, chainId?: number, account?: string, historyKey?: string) =>
    ["spot-cancellation", partner, chainId, account?.toLowerCase(), historyKey] as const,
  client: (partner: Partner, chainId: number) => ["spot-client", partner, chainId] as const,
  orders: (partner: Partner, chainId: number | "all", account?: string) =>
    ["spot-orders", partner, chainId, account?.toLowerCase()] as const,
};

/** Execution clients are initialized on demand and shared per partner/chain. */
export function spotClientQueryOptions(partner: Partner, chainId: number, disableAnalytics = false) {
  return queryOptions({
    queryKey: spotKeys.client(partner, chainId),
    queryFn: () => createClient(partner, chainId, { disableAnalytics }),
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    // SDK clients contain methods and are not JSON data.
    structuralSharing: false,
  });
}

/** One wallet-wide read shared by history, details, notifications and cancellation. */
export function spotOrdersQueryOptions(partner: Partner, account: string | undefined, queryClient: QueryClient) {
  return queryOptions({
    queryKey: spotKeys.orders(partner, "all", account),
    queryFn: async ({ signal }) => {
      if (!account) throw new Error("Connect a wallet to load order history");
      const orders = await getOrders({
        swapper: account,
        exchange: partner,
        getv1orders: false,
        signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
      });
      const tokens = await queryClient.fetchQuery(orderTokensQueryOptions(queryClient, getOrderTokens(orders)));
      signal.throwIfAborted();
      return withOrderTokens(orders, tokens);
    },
    enabled: Boolean(account),
    staleTime: 60_000,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
    retry: false,
    structuralSharing: shareOrders,
  });
}

/** Preserve unchanged rows across polls, including when the server reorders them. */
export function shareOrders(previous: unknown, next: unknown): HistoryOrder[] {
  const oldOrders = previous as HistoryOrder[] | undefined;
  const byKey = new Map((oldOrders ?? []).map(order => [order.historyKey, order]));
  const orders = (next as HistoryOrder[]).map(order => replaceEqualDeep(byKey.get(order.historyKey), order));
  return oldOrders?.length === orders.length && orders.every((order, index) => order === oldOrders[index])
    ? oldOrders
    : orders;
}

/** Refresh the scope captured by the write, even if the wallet has since changed. */
export function invalidateOrderQueries(
  queryClient: QueryClient,
  { partner, chainId, account }: OrderQueryScope,
) {
  return Promise.allSettled([
    queryClient.invalidateQueries({ queryKey: spotKeys.orders(partner, "all", account) }),
    queryClient.invalidateQueries({ queryKey: ["balances", chainId, account.toLowerCase()] }),
  ]);
}
