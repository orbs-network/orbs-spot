"use client";

import { useEffect } from "react";
import { OrderHistoryPage } from "@/components/order-history-modal";
import { TradingSidebar } from "@/components/trading-sidebar";
import { useFormTabStore } from "@/lib/hooks/store";

export function OrdersWorkspace() {
  const setHistoryOpen = useFormTabStore((state) => state.setOrderHistoryOpen);
  useEffect(() => {
    setHistoryOpen(true);
    return () => setHistoryOpen(false);
  }, [setHistoryOpen]);

  return (
    <>
      <TradingSidebar />
      <div data-orders-workspace>
        <OrderHistoryPage />
      </div>
    </>
  );
}
