"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { OrderSettlementError, OrderStatus, watchOrder } from "@orbs-network/spot-ui";
import { useQueries, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { useConnection } from "wagmi";
import { SUPPORTED_CHAINS } from "@/lib/consts";
import { useBestTradeSwapStore } from "@/lib/hooks/store";
import { SwapStatus } from "@/lib/types";
import { getFillTransactionHash, getSwapActivityId, useSwapActivity, type SwapActivity, type SpotSwapActivity } from "@/lib/swap/activity";
import { swapOrderKey, swapSubmissions } from "@/lib/swap/submissions";
import { createSwapToasts } from "@/lib/swap/use-swap-toasts";

const supportedChains = new Set<number>(SUPPORTED_CHAINS.map(chain => chain.id));
const legacyReceiptTimeoutMillis = 24 * 60 * 60 * 1_000;
const completedResults = (results: UseQueryResult<SwapActivity>[]) =>
  results.flatMap(result => result.data && result.data.status !== "pending" ? [result.data] : []);

async function trackSpotSwap(item: SpotSwapActivity, signal: AbortSignal): Promise<SpotSwapActivity> {
  let order = item.order;
  const toasts = createSwapToasts({ id: `recovered-swap-${swapOrderKey(item.chainId, item.orderId)}`,
    inputSymbol: item.inputSymbol, outputSymbol: item.outputSymbol, inputAmount: item.inputAmount, chainId: item.chainId });
  toasts.onSwapConfirming();
  try {
    for await (const current of watchOrder({ order, signal })) order = current;
    if (order.status !== OrderStatus.Completed) throw new Error("Swap fill has not been confirmed");
    const txHash = getFillTransactionHash(order);
    toasts.onSwapSuccess(txHash, order);
    return { ...item, order, txHash, status: "confirmed" };
  } catch (error) {
    // Query disposal stops local tracking. It does not cancel the accepted order.
    if (signal.aborted || !(error instanceof OrderSettlementError) || error.reason === "aborted") {
      toasts.dismissPendingToasts();
      throw error;
    }
    toasts.onSwapFailed(error);
    return { ...item, order, txHash: getFillTransactionHash(order), status: error.reason };
  }
}

async function trackSwap(item: SwapActivity, signal: AbortSignal): Promise<SwapActivity> {
  if (item.kind === "spot") return trackSpotSwap(item, signal);
  try {
    const response = await fetch(`/api/transaction-receipt?chainId=${item.chainId}&hash=${item.hash}`, { signal });
    if (response.status === 202) return { ...item, status: Date.now() - item.createdAt >= legacyReceiptTimeoutMillis ? "unconfirmed" : "pending" };
    if (!response.ok) throw new Error("Confirmation unavailable");
    const receipt = await response.json();
    if (receipt.status !== "success" && receipt.status !== "reverted") throw new Error("Invalid receipt");
    return { ...item, status: receipt.status === "success" ? "confirmed" : "reverted" };
  } catch (error) {
    if (!signal.aborted && Date.now() - item.createdAt >= legacyReceiptTimeoutMillis) return { ...item, status: "unconfirmed" };
    throw error;
  }
}

export function PendingSwapMonitor() {
  const queryClient = useQueryClient();
  useEffect(() => { void useSwapActivity.persist.rehydrate(); }, []);
  const activeHash = useBestTradeSwapStore(state => state.status === SwapStatus.LOADING ? state.txHash : undefined);
  const activeOrderId = useBestTradeSwapStore(state => state.status === SwapStatus.LOADING ? state.orderId : undefined);
  const { address } = useConnection();
  const items = useSwapActivity(state => state.items);
  const activeOrders = useSyncExternalStore(swapSubmissions.subscribe, swapSubmissions.getOrderKeys, swapSubmissions.getServerOrderKeys);
  const pending = useMemo(() => items.filter(item => item.account.toLowerCase() === address?.toLowerCase()
    && item.status === "pending" && supportedChains.has(item.chainId)
    && (item.kind === "spot" ? item.orderId !== activeOrderId && !activeOrders.includes(swapOrderKey(item.chainId, item.orderId)) : item.hash !== activeHash)), [items, address, activeHash, activeOrderId, activeOrders]);
  const completed = useQueries({ combine: completedResults, queries: pending.map(item => ({
    queryKey: ["persisted-swap-status", item.kind ?? "transaction", item.chainId, getSwapActivityId(item)],
    queryFn: ({ signal }: { signal: AbortSignal }) => trackSwap(item, signal),
    staleTime: item.kind === "spot" ? Infinity : 10_000,
    // The SDK already polls Spot orders serially through deadline + 60 seconds.
    refetchInterval: item.kind === "spot" ? false as const : 15_000,
    retry: item.kind === "spot" ? false as const : 1,
  })) });
  useEffect(() => {
    for (const result of completed) {
      const activity = useSwapActivity.getState();
      const identity = getSwapActivityId(result);
      // Cached results and Strict Mode replay must not settle/invalidate twice.
      if (result.status !== "pending" && activity.items.some(item => item.chainId === result.chainId
        && getSwapActivityId(item) === identity && item.status === "pending")) {
        activity.settle(result.chainId, identity, result.status, result.kind === "spot" ? result.order : undefined);
        void queryClient.invalidateQueries({ queryKey: ["balances", result.chainId, result.account.toLowerCase()] });
        void queryClient.invalidateQueries({ predicate: query => query.queryKey[0] === "spot-orders"
          && query.queryKey[3] === result.account.toLowerCase() });
      }
    }
  }, [completed, queryClient]);
  return null;
}
