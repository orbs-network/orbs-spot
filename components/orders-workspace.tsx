"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
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
        <Link href="/" className="mb-5 inline-flex min-h-10 items-center gap-2 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary lg:hidden">
          <ArrowLeftIcon aria-hidden="true" className="size-4" />Back to trading
        </Link>
        <OrderHistoryPage />
      </div>
    </>
  );
}
