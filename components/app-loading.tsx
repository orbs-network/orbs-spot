"use client";

import { usePathname } from "next/navigation";
import { FORM_TABS } from "@/lib/consts";
import { FormActionPanel } from "@/components/form-action-panel";
import { FormPanel } from "@/components/ui/form-panel";
import { Skeleton } from "@/components/ui/skeleton";
import { getTradingPathname } from "@/lib/developer-routes";

function LoadingCurrencyCard({ title }: { title: string }) {
  return (
    <FormPanel data-currency-card className="relative flex min-w-0 flex-col gap-2">
      <div data-currency-card-header className="flex items-center justify-between gap-2">
        <div className="relative">
          <p className="invisible text-sm font-medium">{title}</p>
          <Skeleton className="absolute inset-x-0 top-1/2 h-3 -translate-y-1/2" />
        </div>
      </div>
      <div data-currency-amount-row className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <Skeleton className="h-9 w-28 max-w-full" />
        <Skeleton className="h-11 w-32 rounded-[18px]" />
      </div>
      <div data-currency-value-row className="flex items-center justify-between gap-2">
        <div className="relative w-12">
          <p className="invisible text-sm">$0.00</p>
          <Skeleton className="absolute inset-x-0 top-1/2 h-3 -translate-y-1/2" />
        </div>
        <div className="relative w-20">
          <p className="invisible text-sm">Balance: 0</p>
          <Skeleton className="absolute inset-x-0 top-1/2 h-3 -translate-y-1/2" />
        </div>
      </div>
    </FormPanel>
  );
}

function LoadingTradingForm() {
  return (
    <div data-form-root data-trading-workspace className="relative mx-auto mb-20 mt-4 flex w-full min-w-0 flex-col gap-4">
      <div data-workspace-trade>
        <div data-trading-card>
          <div data-form-toolbar className="flex min-w-0 items-center gap-2">
            <div data-spot-order-navigation>
              {FORM_TABS.map(tab => (
                <Skeleton key={tab.value} data-order-tab-placeholder>
                  <span className="invisible">{tab.fullLabel}</span>
                </Skeleton>
              ))}
            </div>
            <div className="hidden size-10 shrink-0 items-center justify-center sm:flex">
              <Skeleton className="size-5" />
            </div>
          </div>
          <div data-form-container className="flex w-full flex-col gap-3 rounded-[21px] border border-border/80 bg-card/95 p-3">
            <div className="flex flex-col gap-2.5">
              <div data-currency-pair className="flex flex-col gap-1.5">
                <div data-percentage-controls>
                  {["25%", "50%", "75%", "Max"].map(label => (
                    <Skeleton key={label} data-percentage-button className="flex items-center">
                      <span className="invisible">{label}</span>
                    </Skeleton>
                  ))}
                </div>
                <LoadingCurrencyCard title="From" />
                <div className="relative z-10 flex h-0 justify-center">
                  <Skeleton data-toggle-currencies-button className="relative" />
                </div>
                <LoadingCurrencyCard title="To" />
              </div>
              <FormActionPanel>
                <Skeleton className="h-14 w-full rounded-[20px]" />
              </FormActionPanel>
            </div>
            <div className="flex min-h-10 items-center gap-2 px-1 sm:hidden">
              <Skeleton className="size-3.5" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="ml-auto h-4 w-16" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Static markup: visible before the wallet and trading providers hydrate. */
export function AppLoading() {
  const isOrders = getTradingPathname(usePathname()).startsWith("/orders");
  return (
    <div data-app-loading role="status" aria-busy="true" className="app-shell min-h-screen text-foreground">
      <span className="sr-only">{isOrders ? "Loading orders…" : "Loading trading interface…"}</span>
      <div aria-hidden="true">
        <div data-app-header className="fixed inset-x-0 top-0 border-b border-border [background:var(--nav-background)] px-4 py-3">
          <div data-nav-layout className="flex items-center justify-between gap-4">
            <div data-mobile-navigation-menu className="flex h-11 items-center"><Skeleton className="size-6" /></div>
            <div data-nav-brand className="flex min-h-8 items-center gap-2">
              <Skeleton className="size-8 sm:size-10" />
              <Skeleton className="h-6 w-24" />
            </div>
            <div data-trading-navigation>
              <div data-trading-modes>
                {[0, 1, 2].map(index => <div key={index} data-trading-mode-placeholder><Skeleton className="h-4 w-14" /></div>)}
              </div>
            </div>
            <Skeleton data-nav-actions className="ml-auto h-10 w-28" />
          </div>
        </div>
        <div id="main-content" className="flex justify-center px-4 pt-[60px] sm:pt-[72px]">
          {isOrders ? <div data-orders-loading className="mx-auto flex w-full max-w-[1400px] flex-col gap-5 rounded-[28px] bg-card p-6">
            <Skeleton className="h-7 w-32" /><Skeleton className="h-10 w-60" />
            {[0, 1, 2, 3, 4].map(index => <Skeleton key={index} className="h-20 w-full rounded-2xl" />)}
          </div> : <LoadingTradingForm />}
        </div>
      </div>
    </div>
  );
}
