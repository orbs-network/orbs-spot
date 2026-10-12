"use client";

import type { ReactNode } from "react";
import { OpenOrdersPanel } from "@/features/order-history/open-orders-panel";

/** Keep the open-orders shortcut directly below the trading form. */
export function TradingWorkspace({ children }: { children: ReactNode }) {
  return (
    <div data-form-root data-trading-workspace className="relative mx-auto mb-20 mt-4 flex w-full min-w-0 flex-col gap-4">
      <div data-workspace-trade>
        {children}
      </div>
      <OpenOrdersPanel />
    </div>
  );
}
