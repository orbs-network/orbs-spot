"use client";

import {
  getTwapConfig,
  OrderStatus,
  type Order,
  type Token,
  type Partners,
} from "@orbs-network/spot-ui";
import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { createElement, useEffect, useMemo, useRef, useState } from "react";
import { useConnection } from "wagmi";
import { useDataChainId } from "@/lib/hooks/use-data-chain-id";
import { spotClientQueryOptions, spotKeys } from "@/lib/spot/queries";
import { useHistoryOrdersQuery } from "@/lib/hooks/use-history-orders-query";
import { isMockOrder } from "@/lib/spot/mock-orders";
import { watchCancelledOrder } from "@/lib/spot/cancel-status";
import { useOrderCancelling } from "@/lib/spot/use-order-cancelling";
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
import { useSpotPartner } from "@/lib/hooks/use-spot-partner";
import { useSpotPartnerChains } from "@/lib/hooks/use-spot-partner-chains";
import { TradeToastDetails } from "@/components/ui/trade-toast-details";
import type { SpotWalletPort } from "@/lib/spot/execution";
import { useSubmissionPreview, type SubmissionPreview } from "@/lib/submission-preview";
import { createLoadingToast } from "@/lib/loading-toast";

export function useClient(requestedChainId?: number, enabled = true) {
  const connectedChainId = useDataChainId();
  const chainId = requestedChainId ?? connectedChainId;
  const { partner, chains } = useSpotPartnerChains(enabled);
  // The host cache owns one client per partner/chain; failed initialization can retry.
  return useQuery({
    ...spotClientQueryOptions(partner, chainId),
    enabled: enabled && chains.some((chain) => chain.id === chainId),
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
  const { partner } = useSpotPartner();
  const { refetch: refetchBalances } = useBalances();
  const { address } = useConnection();
  const chainId = useDataChainId();
  const previous = useRef<{ key: string; orders: Order[] } | undefined>(
    undefined,
  );
  const key = `${partner}:${chainId}:${address}`;
  useEffect(() => {
    // Establish a baseline when the partner, network, or account changes.
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

interface CancellationInput {
  order?: Order;
  address?: string;
  partner: Partners;
  wallet: SpotWalletPort;
  toastId: string;
}

function cancellationPreviews(order?: Pick<Order, "chainId" | "historyKey" | "maker">) {
  if (!order) return [];
  return Object.values(useSubmissionPreview.getState().entries).filter(entry =>
    entry.order?.chainId === order.chainId && entry.order.historyKey === order.historyKey &&
    entry.order.maker.toLowerCase() === order.maker.toLowerCase());
}

function cancellationNotification(title: string, preview: SubmissionPreview | undefined, chainId?: number, message?: string) {
  return {
    title,
    description: createElement(TradeToastDetails, {
      input: preview?.input,
      output: preview?.output,
      chainId,
      message,
      transactions: preview?.transactions,
    }),
  };
}

export function useCancelOrder(order?: Order, partnerOverride?: Partners) {
  const { partner: selectedPartner } = useSpotPartner();
  const partner = partnerOverride ?? selectedPartner;
  const wallet = useWalletInteractions();
  const { address } = useConnection();
  const queryClient = useQueryClient();
  const isOrderCancelling = useOrderCancelling(order, partner);
  const toastId = `${CANCEL_ORDER_TOAST_ID}:${partner}:${order?.chainId}:${order?.maker.toLowerCase()}:${order?.historyKey}`;
  const [confirmed, setConfirmed] = useState<{ toastId: string; hash: `0x${string}` }>();
  // Cancellation is a wallet write: start it only from an explicit user action.
  const mutation = useMutation({
    mutationKey: spotKeys.cancellation(partner, order?.chainId, order?.maker, order?.historyKey),
    mutationFn: async ({ order, address, partner, wallet, toastId }: CancellationInput) => {
      if (isMockOrder(order)) throw new Error("Sample orders are read-only");
      if (!order || !address)
        throw new Error("Connect the order's wallet and network to cancel");
      // Keep the submission's scope if the selector or wallet changes while the
      // client loads, the wallet confirms, or history catches up.
      const scope = { partner, chainId: order.chainId, account: address, historyKey: order.historyKey, toastId };
      const client = await queryClient.fetchQuery(spotClientQueryOptions(scope.partner, scope.chainId, true));
      const cached = queryClient.getQueryData<Order[]>(spotKeys.orders(scope.partner, "all", scope.account));
      const latest = cached?.find(item => item.chainId === scope.chainId && item.historyKey === scope.historyKey) ?? order;
      const hash = await cancelSdkOrder(client, wallet, latest, scope.account);
      // Retain receipt links with the captured submission details even after
      // its form closes, so later notifications include confirmed transactions.
      for (const preview of cancellationPreviews(latest)) {
        useSubmissionPreview.getState().upsert({
          ...preview,
          transactions: [{ label: "Cancellation transaction", hash }],
        });
      }
      setConfirmed({ toastId: scope.toastId, hash });
      return {
        ...scope,
        hash,
      };
    },
    retry: false,
    onMutate: ({ toastId, order }) => {
      setConfirmed(undefined);
      const loadingToast = createLoadingToast(toastId);
      const notification = cancellationNotification("Cancelling order…", cancellationPreviews(order)[0], order?.chainId);
      loadingToast.show(notification.title, { description: notification.description });
      return { toastId, loadingToast };
    },
    onSuccess: async (result, _variables, context) => {
      const preview = cancellationPreviews({ chainId: result.chainId, historyKey: result.historyKey, maker: result.account })[0];
      const details = cancellationNotification("Confirming order cancellation…", preview, result.chainId);
      const notification = {
        id: result.toastId,
        description: preview ? details.description : createElement(TradeToastDetails, {
          chainId: result.chainId,
          transactions: [{ label: "Cancellation transaction", hash: result.hash }],
        }),
      };
      const loadingToast = context?.loadingToast ?? createLoadingToast(result.toastId);
      loadingToast.show(details.title, { description: notification.description });
      const refresh = watchCancelledOrder(queryClient, result);
      void queryClient.invalidateQueries({
        queryKey: ["balances", result.chainId, result.account.toLowerCase()],
      }).catch(() => { /* A balance refresh cannot undo a confirmed cancellation. */ });
      const status = await refresh.finished;
      if (status === OrderStatus.Cancelled) {
        toast.success("Order cancelled", notification);
      } else if (status === OrderStatus.Completed) {
        toast.info("Order already filled", notification);
      } else if (status === OrderStatus.Expired) {
        toast.info("Order expired", notification);
      } else {
        toast.dismiss(result.toastId);
      }
    },
    onError: (error, variables, context) => {
      const id = context?.toastId;
      if (isUserRejectedError(error)) {
        dismissTransactionRejectedToast({ id });
      } else {
        const preview = cancellationPreviews(variables.order)[0];
        const notification = cancellationNotification("Cancel failed", preview, variables.order?.chainId, error.message);
        toast.error(notification.title, {
          id,
          description: preview ? notification.description : error.message,
        });
      }
    },
  });
  return {
    cancelOrder: (_variables?: void, options?: Parameters<typeof mutation.mutate>[1]) =>
      mutation.mutate({ order, address, partner, wallet, toastId }, options),
    isLoading: mutation.isPending || isOrderCancelling,
    isSuccess: mutation.isSuccess,
    transactionHash: confirmed?.toastId === toastId ? confirmed.hash : undefined,
  };
}

export function useHistoryOrder(
  order?: Order,
  inputToken?: Token,
  outputToken?: Token,
) {
  const { partner } = useSpotPartner();
  return useMemo(
    () =>
      order
        ? describeOrder(
            order,
            inputToken,
            outputToken,
            order.version === 1
              ? getTwapConfig(partner, order.chainId)
              : undefined,
          )
        : undefined,
    [order, inputToken, outputToken, partner],
  );
}
