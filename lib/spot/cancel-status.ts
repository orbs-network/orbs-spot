import { OrderStatus } from "@orbs-network/spot-ui";
import { QueryObserver, type QueryClient } from "@tanstack/react-query";
import {
  shareOrders,
  spotClientQueryOptions,
  spotKeys,
  type NetworkOrders,
  type OrderQueryScope,
} from "./queries";

/** Keep the confirmed cancellation's original scope until history catches up. */
export function watchCancelledOrder(
  queryClient: QueryClient,
  { partner, chainId, account, historyKey }: OrderQueryScope & { historyKey: string },
) {
  const allOrdersKey = spotKeys.orders(partner, "all", account);
  // An older all-chain request must not overwrite the refreshed order status.
  void queryClient.cancelQueries({ queryKey: allOrdersKey, exact: true });
  const observer = new QueryObserver(queryClient, {
    queryKey: spotKeys.orders(partner, chainId, account),
    queryFn: async ({ signal }) => {
      const client = await queryClient.fetchQuery(spotClientQueryOptions(partner, chainId, true));
      signal.throwIfAborted();
      return client.getAccountOrders({ account, signal, getv1orders: false });
    },
    staleTime: 0,
    refetchOnMount: "always",
    refetchInterval: 2_000,
    refetchIntervalInBackground: true,
    // A failed read is retried by polling; the cancellation itself already succeeded.
    retry: false,
    structuralSharing: shareOrders,
  });

  const unsubscribeCache = queryClient.getQueryCache().subscribe(event => {
    if (event.type === "removed" && event.query === observer.getCurrentQuery()) stop();
  });
  let onFinished = () => {};
  const finished = new Promise<void>(resolve => { onFinished = resolve; });
  function stop() {
    unsubscribeCache();
    observer.destroy();
    onFinished();
  }

  observer.subscribe(result => {
    if (!result.isSuccess || result.isFetching) return;
    const updatedOrder = result.data.find(order => order.historyKey === historyKey && order.chainId === chainId);
    // An incomplete response is not confirmation that the status changed.
    if (!updatedOrder) return;

    queryClient.setQueryData<NetworkOrders>(allOrdersKey, previous => {
      if (!previous) return undefined;
      const refreshed = new Map(result.data.map(order => [order.historyKey, order]));
      const orders = previous.orders.flatMap(order => {
        if (order.chainId !== chainId) return [order];
        const next = refreshed.get(order.historyKey);
        refreshed.delete(order.historyKey);
        return next ? [next] : [];
      });
      return {
        orders: shareOrders(previous.orders, [...orders, ...refreshed.values()]),
        failures: previous.failures.filter(failure => failure.chainId !== chainId),
      };
    });

    if (updatedOrder.status !== OrderStatus.Open) stop();
  });

  // The observer survives drawer unmounts and wallet/network switches. Destroying
  // its query (e.g. clearing the cache) also stops its interval and pending read.
  return { stop, finished };
}
