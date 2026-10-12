"use client";

import { usePathname } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";

/** Static markup: visible before the wallet and trading providers hydrate. */
export function AppLoading() {
  const isOrders = usePathname() === "/orders";
  return (
    <div data-app-loading role="status" aria-busy="true" className="ef-app-shell min-h-screen text-foreground">
      <span className="sr-only">{isOrders ? "Loading orders…" : "Loading trading interface…"}</span>
      <div aria-hidden="true">
        <div data-app-header className="fixed inset-x-0 top-0 border-b border-border [background:var(--nav-background)] px-4 py-3">
          <div data-nav-layout className="flex items-center justify-between gap-4">
            <Skeleton data-nav-brand className="h-8 w-32" />
            <div data-trading-navigation>
              <div className="flex items-center gap-6">
                {[0, 1, 2].map((index) => <Skeleton key={index} className="h-4 w-14" />)}
              </div>
            </div>
            <Skeleton data-nav-actions className="h-10 w-28" />
          </div>
        </div>
        <div id="main-content" className="flex justify-center px-4 pt-[72px]">
          {isOrders ? <div data-orders-loading className="mx-auto flex w-full max-w-[1400px] flex-col gap-5 rounded-[28px] bg-card p-6">
            <Skeleton className="h-7 w-32" /><Skeleton className="h-10 w-60" />
            {[0, 1, 2, 3, 4].map(index => <Skeleton key={index} className="h-20 w-full rounded-2xl" />)}
          </div> : <div data-form-root className="mx-auto flex w-full min-w-0 max-w-[520px] flex-col gap-4">
            <div data-trading-card className="contents">
              <div className="flex gap-1 overflow-hidden">
                {[0, 1, 2, 3, 4].map((index) => <Skeleton key={index} className="h-11 min-w-14 flex-1 rounded-t-[14px] rounded-b-none" />)}
              </div>
              <div data-form-container className="flex flex-col gap-5 rounded-[28px] bg-card p-6">
                <div className="flex items-center justify-between"><Skeleton className="h-6 w-24" /><Skeleton className="size-8" /></div>
                <div className="flex gap-2 md:mt-3">{[0, 1, 2, 3].map((index) => <Skeleton key={index} className="h-9 w-14 rounded-[14px] md:h-10" />)}</div>
                <Skeleton className="h-30 w-full rounded-[20px] md:h-36" />
                <Skeleton className="mx-auto size-10 rounded-full" />
                <Skeleton className="h-30 w-full rounded-[20px] md:h-36" />
                <Skeleton className="h-14 w-full rounded-[18px]" />
              </div>
            </div>
          </div>}
        </div>
      </div>
    </div>
  );
}
