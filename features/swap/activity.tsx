"use client";

import { useEffect, useMemo } from "react";
import { useQueries, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { useConnection } from "wagmi";
import { SUPPORTED_CHAINS } from "@/lib/consts";
import { useBestTradeSwapStore } from "@/lib/hooks/store";
import { SwapStatus } from "@/lib/types";
import { useSwapActivity, type SwapActivity } from "@/lib/swap/activity";

const supportedChains = new Set<number>(SUPPORTED_CHAINS.map(chain => chain.id));
const completedReceipts = (results: UseQueryResult<SwapActivity>[]) =>
  results.flatMap(result => result.data && result.data.status !== "pending" ? [result.data] : []);

export function PendingSwapMonitor() {
  const queryClient = useQueryClient();
  useEffect(() => { void useSwapActivity.persist.rehydrate(); }, []);
  const activeHash = useBestTradeSwapStore(state => state.status === SwapStatus.LOADING ? state.txHash : undefined);
  const { address } = useConnection();
  const items = useSwapActivity(state => state.items);
  const pending = useMemo(() => items.filter(item => item.account.toLowerCase() === address?.toLowerCase()
    && item.status === "pending" && item.hash !== activeHash && supportedChains.has(item.chainId)), [items, address, activeHash]);
  const completed = useQueries({ combine: completedReceipts, queries: pending.map(item => ({
    queryKey: ["persisted-swap-receipt", item.chainId, item.hash],
    queryFn: async ({ signal }: { signal: AbortSignal }) => {
      const response = await fetch(`/api/transaction-receipt?chainId=${item.chainId}&hash=${item.hash}`, { signal });
      if (response.status === 202) return { ...item, status: "pending" as const };
      if (!response.ok) throw new Error("Confirmation unavailable");
      const receipt = await response.json();
      if (receipt.status !== "success" && receipt.status !== "reverted") throw new Error("Invalid receipt");
      return { ...item, status: receipt.status === "success" ? "confirmed" as const : "reverted" as const };
    },
    staleTime: 10_000, refetchInterval: 15_000, retry: 1,
  })) });
  useEffect(() => {
    for (const receipt of completed) {
      const activity = useSwapActivity.getState();
      // A cached receipt or Strict Mode effect replay must not settle/invalidate twice.
      if (receipt.status !== "pending" && activity.items.some(item => item.chainId === receipt.chainId
        && item.hash === receipt.hash && item.status === "pending")) {
        activity.settle(receipt.chainId, receipt.hash, receipt.status);
        void queryClient.invalidateQueries({ queryKey: ["balances", receipt.chainId, receipt.account.toLowerCase()] });
      }
    }
  }, [completed, queryClient]);
  return null;
}
