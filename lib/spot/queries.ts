import { createClient, type Order } from "@orbs-network/spot-ui";
import { queryOptions, replaceEqualDeep, type QueryClient } from "@tanstack/react-query";

type Partner = Parameters<typeof createClient>[0];

export type OrderQueryScope = { partner: Partner; chainId: number; account: string };
export type NetworkOrders = {
  orders: Order[];
  failures: { chainId: number; error: Error }[];
};

export const spotKeys = {
  cancellation: (partner: Partner, chainId?: number, account?: string, historyKey?: string) =>
    ["spot-cancellation", partner, chainId, account?.toLowerCase(), historyKey] as const,
  client: (partner: Partner, chainId: number) => ["spot-client", partner, chainId] as const,
  orders: (partner: Partner, chainId: number | "all", account?: string) =>
    ["spot-orders", partner, chainId, account?.toLowerCase()] as const,
};

/** Both imperative history reads and form observers share one SDK client. */
export function spotClientQueryOptions(partner: Partner, chainId: number, disableAnalytics = false) {
  return queryOptions({
    queryKey: spotKeys.client(partner, chainId),
    queryFn: () => createClient(partner, chainId, { disableAnalytics }),
    staleTime: Infinity,
    retry: false,
    // SDK clients contain methods and are not JSON data.
    structuralSharing: false,
  });
}

/** Preserve unchanged rows across polls, including when the server reorders them. */
export function shareOrders(previous: unknown, next: unknown): Order[] {
  const oldOrders = previous as Order[] | undefined;
  const byKey = new Map((oldOrders ?? []).map(order => [order.historyKey, order]));
  const orders = (next as Order[]).map(order => replaceEqualDeep(byKey.get(order.historyKey), order));
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
    queryClient.invalidateQueries({ queryKey: spotKeys.orders(partner, chainId, account) }),
  ]);
}
