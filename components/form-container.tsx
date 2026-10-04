"use client";

/* eslint-disable @next/next/no-img-element */
import React from "react";
import { ExternalLinkIcon } from "lucide-react";
import { useRouter } from "next/navigation";

import { FORM_TABS, PERPS_URL } from "@/lib/consts";
import { useSelectedFormTab } from "@/lib/hooks/use-form-tab";
import { useFormTabStore } from "@/lib/hooks/store";
import { FormTab } from "@/lib/types";
import { OrderHistoryTrigger } from "./order-history-trigger";
import { StyledSelect } from "./ui/styled-select";
import { SegmentedTabs } from "./ui/tabs";
import { IS_ORBS } from "@/lib/partners/client";
import { SettingsModal } from "./settings-modal";
import { TradeNetworkSelector } from "./trade-network-selector";

const MOBILE_FORM_TAB_OPTIONS = FORM_TABS.map((tab) => ({
  value: tab.value,
  label: tab.fullLabel,
}));

const DESKTOP_FORM_TAB_OPTIONS = FORM_TABS.map((tab) => ({
  value: tab.value,
  label: tab.label,
  title: tab.fullLabel,
}));

const FormHeader = () => {
  const { selectedTab, setSelectedTab } = useSelectedFormTab();

  return (
    <div data-form-header className="flex items-center gap-2">
      <div className="min-w-0 flex-1 sm:hidden">
        <StyledSelect
          aria-label="Order type"
          value={selectedTab.value}
          onValueChange={setSelectedTab}
          options={MOBILE_FORM_TAB_OPTIONS}
        />
      </div>
      <SegmentedTabs
        aria-label="Order type"
        value={selectedTab.value}
        options={IS_ORBS ? MOBILE_FORM_TAB_OPTIONS : DESKTOP_FORM_TAB_OPTIONS}
        onValueChange={setSelectedTab}
      />
      {IS_ORBS && (
        <a
          href={PERPS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 border border-border px-3 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
        >
          Perps
          <ExternalLinkIcon aria-hidden="true" className="size-3.5 shrink-0" strokeWidth={1.5} />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      )}
    </div>
  );
};

const FormSectionHeader = ({
  showOrderHistory,
  onOpenOrderHistory,
  title,
}: {
  showOrderHistory: boolean;
  onOpenOrderHistory: () => void;
  title: string;
}) => {
  return (
    <div
      data-form-section-header
      className="flex min-h-11 flex-wrap items-center justify-between gap-3 px-1"
    >
      <h2 className="min-w-0 text-[18px] font-bold leading-tight text-foreground">
        {title}
      </h2>
      <div data-trade-header-actions className="ml-auto flex max-w-full flex-wrap items-center justify-end gap-2">
        {showOrderHistory && (
          <div data-trade-history-action className={IS_ORBS ? "lg:hidden max-sm:[&_span]:hidden max-sm:[&_button]:px-2.5" : undefined}>
            <OrderHistoryTrigger onOpen={onOpenOrderHistory} />
          </div>
        )}
        <TradeNetworkSelector />
        {IS_ORBS && <SettingsModal triggerVariant="icon" />}
      </div>
    </div>
  );
};

const PoweredBy = () => {
  return (
    <a
      data-powered-by
      href="https://www.orbs.com/"
      target="_blank"
      rel="noopener noreferrer"
      className="mt-4 flex flex-row items-center justify-center gap-2.5 text-[15px] font-medium text-foreground transition-colors hover:text-foreground"
    >
      <span>Powered by Orbs</span>
      <img
        src="https://raw.githubusercontent.com/orbs-network/twap-ui/master/logo/orbslogo.svg"
        alt="Orbs"
        width={25}
        height={25}
        loading="lazy"
        className="size-[25px]"
      />
    </a>
  );
};


export function FormContainer({
  children,
}: {
  children: React.ReactNode;
}) {
  const { selectedTab } = useSelectedFormTab();
  const setOrderHistoryOpen = useFormTabStore(
    (state) => state.setOrderHistoryOpen,
  );
  const router = useRouter();
  const openOrderHistory = React.useCallback(() => {
    if (IS_ORBS) router.push("/orders");
    else setOrderHistoryOpen(true);
  }, [router, setOrderHistoryOpen]);

  return (
    <div
      data-form-root
      className="mx-auto mb-[80px] mt-4 flex w-full min-w-0 max-w-[calc(100vw-2rem)] flex-col gap-4 sm:max-w-[480px]"
    >
      <div
        data-form-container
        className="flex w-full flex-col gap-3 rounded-[21px] border border-border/80 bg-card/95 p-3 backdrop-blur"
      >
        <FormHeader />
        <FormSectionHeader
          title={selectedTab.fullLabel}
          onOpenOrderHistory={openOrderHistory}
          showOrderHistory={IS_ORBS || selectedTab.value !== FormTab.SWAP}
        />
        {children}
      </div>
      {!IS_ORBS && <PoweredBy />}
    </div>
  );
}
