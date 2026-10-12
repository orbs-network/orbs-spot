import { OrderStatus } from "@orbs-network/spot-ui";
import { QueryObserver, type QueryClient } from "@tanstack/react-query";
import {
  spotOrdersQueryOptions,
  spotKeys,
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
    ...spotOrdersQueryOptions(partner, account, queryClient),
    staleTime: 0,
    refetchOnMount: "always",
    refetchInterval: 2_000,
    refetchIntervalInBackground: true,
    // A failed read is retried by polling; the cancellation itself already succeeded.
    retry: false,
  });

  const unsubscribeCache = queryClient.getQueryCache().subscribe(event => {
    if (event.type === "removed" && event.query === observer.getCurrentQuery()) stop();
  });
  let onFinished: (status?: OrderStatus) => void = () => {};
  const finished = new Promise<OrderStatus | undefined>(resolve => { onFinished = resolve; });
  function stop(status?: OrderStatus) {
    unsubscribeCache();
    observer.destroy();
    onFinished(status);
  }

  observer.subscribe(result => {
    if (!result.isSuccess || result.isFetching) return;
    const updatedOrder = result.data.find(order => order.historyKey === historyKey && order.chainId === chainId);
    // An incomplete response is not confirmation that the status changed.
    if (!updatedOrder) return;

    if (updatedOrder.status !== OrderStatus.Open) stop(updatedOrder.status);
  });

  // The observer survives drawer unmounts and wallet/network switches. Destroying
  // its query (e.g. clearing the cache) also stops its interval and pending read.
  return { stop, finished };
}
