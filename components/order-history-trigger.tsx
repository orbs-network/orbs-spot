"use client";

import { Button } from "@/components/ui/button";
import { HistoryIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { preserveFormTabInHref, useSelectedFormTab } from "@/lib/hooks/use-form-tab";
import { useOpenOrders } from "@/features/order-history/use-open-orders";

export function OrderHistoryLink() {
  const { selectedTab } = useSelectedFormTab();
  const pathname = usePathname();
  const { count } = useOpenOrders();
  return (
    <Link href={preserveFormTabInHref("/orders", selectedTab.value)}
      aria-current={pathname === "/orders" || pathname.startsWith("/orders/") ? "page" : undefined}
      aria-label={count ? `Orders, ${count} open advanced orders` : "Orders"}>
      Orders{count > 0 && <span data-orders-nav-count className="tabular-nums"> · {count}</span>}
    </Link>
  );
}

export function OrderHistoryTrigger({ onOpen }: { onOpen: () => void }) {
  return (
    <Button
      type="button"
      variant="outline"
      aria-label="Open order history"
      onClick={onOpen}
      className="h-10 shrink-0 gap-2 rounded-[12px] border-border/70 bg-secondary/35 px-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary/40 "
    >
      <HistoryIcon aria-hidden="true" className="size-4" />
      <span>Orders</span>
    </Button>
  );
}
