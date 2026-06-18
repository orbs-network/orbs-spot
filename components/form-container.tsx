/* eslint-disable @next/next/no-img-element */
import { cn } from "@/lib/utils";
import React from "react";
import { FORM_TABS } from "@/lib/consts";
import { useSelectedFormTab } from "@/lib/hooks/use-form-tab";
import { OrderHistoryProvider } from "./order-history-context";
import { OrderHistoryTrigger } from "./order-history-trigger";

const FormHeader = () => {
  const { selectedTab, setSelectedTab } = useSelectedFormTab();
  const activeTabIndex = React.useMemo(() => {
    const index = FORM_TABS.findIndex((tab) => tab.value === selectedTab.value);
    return Math.max(index, 0);
  }, [selectedTab.value]);

  return (
    <div className="flex items-center gap-2">
      <div
        role="tablist"
        aria-label="Order type"
        className="relative grid min-w-0 flex-1 grid-cols-5 overflow-hidden rounded-[22px] border border-border/70 bg-secondary/50 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
      >
        <div
          aria-hidden="true"
          className="absolute inset-y-1 left-1 z-0 rounded-[17px] bg-primary shadow-[var(--tab-active-shadow)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
          style={{
            width: "calc((100% - 0.5rem) / 5)",
            transform: `translateX(${activeTabIndex * 100}%)`,
          }}
        />
        {FORM_TABS.map((tab) => {
          const selected = tab.value === selectedTab.value;
          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={selected}
              title={tab.fullLabel}
              onClick={() => setSelectedTab(tab.value)}
              className={cn(
                "relative z-10 h-10 rounded-[17px] px-1 text-[13px] font-semibold transition-colors duration-200 sm:text-sm",
                selected
                  ? "text-primary-foreground hover:text-primary-foreground"
                  : "text-muted-foreground hover:bg-white/[0.03] hover:text-foreground"
              )}
            >
              <span className="hidden sm:inline">{tab.fullLabel}</span>
              <span className="sm:hidden">{tab.label}</span>
            </button>
          );
        })}
      </div>
      <OrderHistoryTrigger />
    </div>
  );
};

const PoweredBy = () => {
  return (
    <a
      href="https://www.orbs.com/"
      target="_blank"
      rel="noopener noreferrer"
      className="mt-3 flex flex-row items-center justify-center gap-2 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
    >
      <span>Powered by Orbs</span>
      <img
        src="https://raw.githubusercontent.com/orbs-network/twap-ui/master/logo/orbslogo.svg"
        alt="Orbs"
        width={24}
        height={24}
        className="size-6"
      />
    </a>
  );
};

export function FormContainer({ children }: { children: React.ReactNode }) {
  return (
    <OrderHistoryProvider>
      <div className="mx-auto mb-[100px] mt-12 flex w-full min-w-0 max-w-[calc(100vw_-_2rem)] flex-col gap-4 sm:max-w-[520px]">
        <div className="flex w-full flex-col gap-3 rounded-[26px] border border-border/80 bg-card/95 p-3 shadow-[var(--form-card-shadow)] backdrop-blur">
          <FormHeader />
          {children}
        </div>
        <PoweredBy />
      </div>
    </OrderHistoryProvider>
  );
}
