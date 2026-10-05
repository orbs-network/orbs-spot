"use client";

import Link from "next/link";
import { ArrowRightIcon, XIcon } from "lucide-react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { OrderStatus } from "@orbs-network/spot-ui";
import { useConnection } from "wagmi";
import { preserveFormTabInHref, useSelectedFormTab } from "@/lib/hooks/use-form-tab";
import { useNetworkOrders } from "./use-network-orders";

// Remember acknowledged orders rather than a count: one order can close while
// another opens, leaving the count unchanged but still requiring a new notice.
const useNotificationDismissal = create<{
  wallets: Record<string, string[]>;
  dismiss: (wallet: string, orderKeys: string[]) => void;
}>()(persist((set) => ({
  wallets: {},
  dismiss: (wallet, orderKeys) => set(state => ({ wallets: { ...state.wallets, [wallet]: orderKeys } })),
}), {
  name: "orbs-open-orders-dismissal",
  storage: createJSONStorage(() => localStorage),
  partialize: state => ({ wallets: state.wallets }),
}));

/** Mounted only in the trading workspace; history observes the same query. */
export function OpenOrdersNotification() {
  const { address, isConnected } = useConnection();
  const wallet = address?.toLowerCase() ?? "";
  const dismissedOrderKeys = useNotificationDismissal(state => state.wallets[wallet]);
  const dismiss = useNotificationDismissal(state => state.dismiss);
  const { selectedTab } = useSelectedFormTab();
  // Keep observing after dismissal so a newly opened order can bring it back.
  const { data } = useNetworkOrders(isConnected);
  const openOrders = data.orders.filter(order => order.status === OrderStatus.Open);
  const count = openOrders.length;
  const dismissed = dismissedOrderKeys !== undefined && openOrders.every(order => dismissedOrderKeys.includes(order.historyKey));

  if (!isConnected || !address || dismissed || count === 0) return null;

  return (
    <aside data-open-orders-notification aria-label="Open orders" className="fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-30 flex items-stretch border border-primary/20 bg-popover text-popover-foreground shadow-sm sm:left-auto sm:right-6 sm:bottom-6">
      <Link
        href={preserveFormTabInHref("/orders?filter=open", selectedTab.value)}
        className="flex min-h-12 min-w-0 flex-1 items-center justify-center gap-2 px-3 py-3 text-xs hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary sm:text-sm"
      >
        <span role="status" aria-atomic="true" className="font-medium tabular-nums">{count} open {count === 1 ? "order" : "orders"}</span>
        <span aria-hidden="true" className="text-muted-foreground">·</span>
        <span className="inline-flex items-center gap-1.5 text-primary">View orders <ArrowRightIcon aria-hidden="true" className="size-4" /></span>
      </Link>
      <button
        type="button"
        aria-label="Dismiss open orders notification"
        onClick={() => dismiss(wallet, data.orders.map(order => order.historyKey))}
        className="flex min-h-11 w-11 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
      >
        <XIcon aria-hidden="true" className="size-4" />
      </button>
    </aside>
  );
}
