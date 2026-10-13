"use client";

import {
  getTwapConfig,
  OrderStatus,
  type Order,
  type Token,
} from "@orbs-network/spot-ui";
import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useMemo, useRef } from "react";
import { useConnection } from "wagmi";
import { useDataChainId } from "@/lib/hooks/use-data-chain-id";
import { spotClientQueryOptions, spotKeys } from "@/lib/spot/queries";
import { useHistoryOrdersQuery } from "@/lib/hooks/use-history-orders-query";
import { isMockOrder } from "@/lib/spot/mock-orders";
import { watchCancelledOrder } from "@/lib/spot/cancel-status";
import { useOrderCancelling } from "@/lib/spot/use-order-cancelling";
import { SPOT_CHAINS } from "@/lib/consts";
import { getActiveSpotPartner } from "@/lib/partners/spot";
import { cancelOrder as cancelSdkOrder } from "@/lib/spot/cancellation";
import { describeOrder } from "@/lib/spot/history";
import type { HistoryOrder } from "@/lib/spot/order-tokens";
import { toast } from "sonner";
import { useBalances } from "@/lib/hooks/use-balances";
import {
  isUserRejectedError,
  dismissTransactionRejectedToast,
} from "@/lib/tx-rejection";
import { CANCEL_ORDER_TOAST_ID } from "./constants";
import { useWalletInteractions } from "./hooks";

export function useClient(requestedChainId?: number, enabled = true) {
  const connectedChainId = useDataChainId();
  const chainId = requestedChainId ?? connectedChainId;
  const partner = getActiveSpotPartner();
  // The host cache owns one client per partner/chain; failed initialization can retry.
  return useQuery({
    ...spotClientQueryOptions(partner, chainId),
    enabled: enabled && SPOT_CHAINS.some((chain) => chain.id === chainId),
  });
}

const EMPTY_ORDERS: HistoryOrder[] = [];
export function useOrders(enabled = true) {
  const chainId = useDataChainId();
  const query = useHistoryOrdersQuery(enabled);
  const orders = useMemo(() => query.data?.filter(order => order.chainId === chainId) ?? EMPTY_ORDERS, [query.data, chainId]);
  const data = useMemo(() => ({ all: orders }), [orders]);
  return {
    ...query,
    data,
  };
}

/** One observer on the existing form, independent of form-input subscriptions. */
export function useHistoryNotifications(orders: Order[]) {
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
      for (const order of orders) {
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
    previous.current = { key, orders };
  }, [orders, refetchBalances, key]);
}

export function useCancelOrder(order?: Order) {
  const wallet = useWalletInteractions();
  const { address } = useConnection();
  const queryClient = useQueryClient();
  const isOrderCancelling = useOrderCancelling(order);
  // Cancellation is a wallet write: start it only from an explicit user action.
  const mutation = useMutation({
    mutationKey: spotKeys.cancellation(getActiveSpotPartner(), order?.chainId, address, order?.historyKey),
    mutationFn: async () => {
      if (isMockOrder(order)) throw new Error("Sample orders are read-only");
      if (!order || !address)
        throw new Error("Connect the order's wallet and network to cancel");
      const client = await queryClient.fetchQuery(spotClientQueryOptions(getActiveSpotPartner(), order.chainId, true));
      const hash = await cancelSdkOrder(client, wallet, order, address);
      return {
        hash,
        partner: client.partner,
        chainId: client.chainId,
        account: address,
        historyKey: order.historyKey,
      };
    },
    retry: false,
    onMutate: () => {
      toast.loading("Cancelling order…", { id: CANCEL_ORDER_TOAST_ID });
    },
    onSuccess: async (result) => {
      toast.loading("Confirming order cancellation…", { id: CANCEL_ORDER_TOAST_ID });
      const refresh = watchCancelledOrder(queryClient, result);
      void queryClient.invalidateQueries({
        queryKey: ["balances", result.chainId, result.account.toLowerCase()],
      }).catch(() => { /* A balance refresh cannot undo a confirmed cancellation. */ });
      const status = await refresh.finished;
      if (status === OrderStatus.Cancelled) {
        toast.success("Order cancelled", { id: CANCEL_ORDER_TOAST_ID });
      } else if (status === OrderStatus.Completed) {
        toast.info("Order already filled", { id: CANCEL_ORDER_TOAST_ID });
      } else if (status === OrderStatus.Expired) {
        toast.info("Order expired", { id: CANCEL_ORDER_TOAST_ID });
      } else {
        toast.dismiss(CANCEL_ORDER_TOAST_ID);
      }
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
    isLoading: mutation.isPending || isOrderCancelling,
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
