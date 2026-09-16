"use client";

import {
  createClient,
  getTwapConfig,
  OrderStatus,
  type Order,
  type Token,
} from "@orbs-network/spot-ui";
import {
  useQuery,
  useMutation,
  useQueryClient,
  replaceEqualDeep,
} from "@tanstack/react-query";
import { useEffect, useMemo, useRef } from "react";
import { useConnection } from "wagmi";
import { useDataChainId } from "@/lib/hooks/use-data-chain-id";
import { useFormTabStore } from "@/lib/hooks/store";
import { getActiveSpotPartner } from "@/lib/partners/spot";
import { cancelOrder as cancelSdkOrder } from "@/lib/spot/cancellation";
import { describeOrder } from "@/lib/spot/history";
import { toast } from "sonner";
import { useBalances } from "@/lib/hooks/use-balances";
import {
  isUserRejectedError,
  dismissTransactionRejectedToast,
} from "@/lib/tx-rejection";
import { CANCEL_ORDER_TOAST_ID } from "./constants";
import { useWalletInteractions } from "./hooks";

export function useClient() {
  const chainId = useDataChainId();
  const partner = getActiveSpotPartner();
  // The host cache owns one client per partner/chain; failed initialization can retry.
  return useQuery({
    queryKey: ["spot-client", partner, chainId],
    queryFn: () => createClient(partner, chainId),
    staleTime: Infinity,
    retry: false,
    // This cached value is an SDK client with methods, not a JSON response.
    structuralSharing: false,
  });
}

const EMPTY_ORDERS: Order[] = [];
export function useOrders() {
  const { address } = useConnection();
  const chainId = useDataChainId();
  const partner = getActiveSpotPartner();
  const client = useClient();
  const open = useFormTabStore((state) => state.orderHistoryOpen);
  // Every request-defining value belongs in the key so wallets, chains and
  // partners cannot reuse each other's history. signal lets Query cancel the read.
  const query = useQuery({
    queryKey: ["spot-orders", partner, chainId, address?.toLowerCase()],
    queryFn: ({ signal }) => {
      if (!client.data || !address)
        throw new Error("Connect a wallet to load order history");
      return client.data.getAccountOrders({ account: address, signal });
    },
    enabled: Boolean(client.data && address),
    // Deliberately poll only while history is open. Fill notifications follow
    // these reads (and explicit refreshes), rather than a background watcher.
    refetchInterval: open ? 10_000 : false,
    refetchIntervalInBackground: false,
    staleTime: 5_000,
    // Preserve unchanged row objects by protocol identity, even if polling reorders them.
    structuralSharing: (previous, next) => {
      const byKey = new Map(
        ((previous as Order[] | undefined) ?? []).map((order) => [
          order.historyKey,
          order,
        ]),
      );
      return (next as Order[]).map((order) =>
        replaceEqualDeep(byKey.get(order.historyKey), order),
      );
    },
  });
  const orders = query.data ?? EMPTY_ORDERS;
  const data = useMemo(() => ({ all: orders }), [orders]);
  return {
    ...query,
    data,
    isLoading: Boolean(address) && (client.isLoading || query.isLoading),
    error: client.error ?? query.error,
    refetch: client.error ? client.refetch : query.refetch,
  };
}

/** One observer on the existing form, independent of form-input subscriptions. */
export function useHistoryNotifications() {
  const { data } = useOrders();
  const { refetch: refetchBalances } = useBalances();
  const { address } = useConnection();
  const chainId = useDataChainId();
  const previous = useRef<{ key: string; orders: Order[] } | undefined>(
    undefined,
  );
  const key = `${chainId}:${address}`;
  useEffect(() => {
    // Establish a baseline on first load/account change; notify only on later transitions.
    if (previous.current?.key === key) {
      const byKey = new Map(
        previous.current.orders.map((order) => [order.historyKey, order]),
      );
      let fillsChanged = false;
      for (const order of data.all) {
        const old = byKey.get(order.historyKey);
        if (!old) continue;
        if (
          order.status === OrderStatus.Completed &&
          old.status !== order.status
        )
          toast.success("Order filled");
        if (order.srcAmountFilled !== old.srcAmountFilled) {
          fillsChanged = true;
        }
      }
      // One poll can update several orders; refresh the shared balance query once.
      if (fillsChanged) void refetchBalances().catch(() => undefined);
    }
    previous.current = { key, orders: data.all };
  }, [data.all, refetchBalances, key]);
}

export function useCancelOrder(order?: Order) {
  const client = useClient();
  const wallet = useWalletInteractions();
  const { address } = useConnection();
  const queryClient = useQueryClient();
  // Cancellation is a wallet write: start it only from an explicit user action.
  const mutation = useMutation({
    mutationFn: async () => {
      if (!order || !client.data || !address)
        throw new Error("Connect the order's wallet and network to cancel");
      const hash = await cancelSdkOrder(client.data, wallet, order, address);
      return {
        hash,
        partner: client.data.partner,
        chainId: client.data.chainId,
        account: address,
      };
    },
    retry: false,
    onMutate: () => {
      toast.loading("Cancel order…", { id: CANCEL_ORDER_TOAST_ID });
    },
    onSuccess: (result) => {
      toast.success("Order cancelled", { id: CANCEL_ORDER_TOAST_ID });
      // The write is already confirmed. Refresh the original wallet's caches
      // without treating a refresh failure as a failed cancellation.
      void Promise.allSettled([
        queryClient.invalidateQueries({
          queryKey: ["balances", result.chainId, result.account.toLowerCase()],
        }),
        queryClient.invalidateQueries({
          queryKey: [
            "spot-orders",
            result.partner,
            result.chainId,
            result.account.toLowerCase(),
          ],
        }),
      ]);
    },
    onError: (error) => {
      if (isUserRejectedError(error)) {
        dismissTransactionRejectedToast({ id: CANCEL_ORDER_TOAST_ID });
      } else {
        toast.error("Cancel failed", {
          id: CANCEL_ORDER_TOAST_ID,
          description: error.message,
        });
      }
    },
  });
  return {
    cancelOrder: mutation.mutate,
    isLoading: mutation.isPending,
    isSuccess: mutation.isSuccess,
  };
}

export function useHistoryOrder(
  order?: Order,
  inputToken?: Token,
  outputToken?: Token,
) {
  return useMemo(
    () =>
      order
        ? describeOrder(
            order,
            inputToken,
            outputToken,
            order.version === 1
              ? getTwapConfig(getActiveSpotPartner(), order.chainId)
              : undefined,
          )
        : undefined,
    [order, inputToken, outputToken],
  );
}
