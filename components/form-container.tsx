/* eslint-disable @next/next/no-img-element */
import { cn } from "@/lib/utils";
import React from "react";
import { FORM_TABS } from "@/lib/consts";
import { useSelectedFormTab } from "@/lib/hooks/use-form-tab";
import { FormTab } from "@/lib/types";
import { SpotOrderHistoryModal } from "./advanced-order-form";
import { OrderHistoryTrigger } from "./order-history-trigger";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

const FormHeader = ({
  onOpenOrderHistory,
}: {
  onOpenOrderHistory: () => void;
}) => {
  const { selectedTab, setSelectedTab } = useSelectedFormTab();
  const activeTabIndex = React.useMemo(() => {
    const index = FORM_TABS.findIndex((tab) => tab.value === selectedTab.value);
    return Math.max(index, 0);
  }, [selectedTab.value]);

  return (
    <div className="flex items-center gap-2">
      <div className="min-w-0 flex-1 sm:hidden">
        <Select
          value={selectedTab.value}
          onValueChange={(nextValue) => {
            const nextTab = FORM_TABS.find((tab) => tab.value === nextValue);

            if (nextTab) {
              setSelectedTab(nextTab.value);
            }
          }}
        >
          <SelectTrigger className="!h-12 w-full rounded-[18px] border-border/70 bg-secondary/50 px-4 text-sm font-semibold text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-colors hover:border-primary/45 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="rounded-[14px] border-border/80 bg-popover p-1 shadow-[0_18px_70px_rgba(0,0,0,0.45)]">
            {FORM_TABS.map((tab) => (
              <SelectItem
                key={tab.value}
                value={tab.value}
                className="h-10 rounded-[12px] text-muted-foreground hover:bg-secondary/45 hover:text-foreground focus:bg-secondary/45 focus:text-foreground data-[state=checked]:bg-primary/14 data-[state=checked]:text-foreground"
              >
                {tab.fullLabel}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div
        role="tablist"
        aria-label="Order type"
        className="relative hidden min-w-0 flex-1 grid-cols-5 overflow-hidden rounded-[18px] border border-border/70 bg-secondary/50 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:grid"
      >
        <div
          aria-hidden="true"
          className="absolute inset-y-1 left-1 z-0 rounded-[14px] bg-primary shadow-[var(--tab-active-shadow)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
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
                "relative z-10 h-10 rounded-[14px] px-1 font-semibold transition-colors duration-200 sm:text-[13px]",
                selected
                  ? "text-primary-foreground hover:text-primary-foreground"
                  : "text-muted-foreground hover:bg-white/3 hover:text-foreground"
              )}
            >
              <span className="hidden sm:inline">{tab.fullLabel}</span>
              <span className="sm:hidden">{tab.label}</span>
            </button>
          );
        })}
      </div>
      <OrderHistoryTrigger onOpen={onOpenOrderHistory} />
    </div>
  );
};

const PoweredBy = () => {
  return (
    <a
      href="https://www.orbs.com/"
      target="_blank"
      rel="noopener noreferrer"
      className="mt-4 flex flex-row items-center justify-center gap-2.5 text-[15px] font-medium text-foreground transition-colors hover:text-foreground"
    >
      <span>Powered by Orbs</span>
      <img
        src="https://raw.githubusercontent.com/orbs-network/twap-ui/master/logo/orbslogo.svg"
        alt="Orbs"
        className="size-[25px]"
      />
    </a>
  );
};

const ORDER_HISTORY_UNMOUNT_DELAY = 220;

export function FormContainer({
  children,
  orderHistoryOpen,
  onOrderHistoryOpenChange,
}: {
  children: React.ReactNode;
  orderHistoryOpen: boolean;
  onOrderHistoryOpenChange: (open: boolean) => void;
}) {
  const { selectedTab } = useSelectedFormTab();
  const [renderSwapHistoryModal, setRenderSwapHistoryModal] =
    React.useState(orderHistoryOpen);
  const openOrderHistory = React.useCallback(() => {
    setRenderSwapHistoryModal(true);
    onOrderHistoryOpenChange(true);
  }, [onOrderHistoryOpenChange]);

  React.useEffect(() => {
    if (orderHistoryOpen) {
      return;
    }
    if (!renderSwapHistoryModal) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setRenderSwapHistoryModal(false);
    }, ORDER_HISTORY_UNMOUNT_DELAY);

    return () => window.clearTimeout(timeout);
  }, [orderHistoryOpen, renderSwapHistoryModal]);

  return (
    <div className="mx-auto mb-[80px] mt-4 flex w-full min-w-0 max-w-[calc(100vw-2rem)] flex-col gap-4 sm:max-w-[530px]">
      <div className="flex w-full flex-col gap-3 rounded-[21px] border border-border/80 bg-card/95 p-3 shadow-(--form-card-shadow) backdrop-blur">
        <FormHeader onOpenOrderHistory={openOrderHistory} />
        {children}
        {selectedTab.value === FormTab.SWAP && renderSwapHistoryModal && (
          <SpotOrderHistoryModal
            open={orderHistoryOpen}
            onOpenChange={onOrderHistoryOpenChange}
          />
        )}
      </div>
      <PoweredBy />
    </div>
  );
}
