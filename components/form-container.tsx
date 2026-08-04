"use client";

/* eslint-disable @next/next/no-img-element */
import React from "react";

import { FORM_TABS } from "@/lib/consts";
import { useSelectedFormTab } from "@/lib/hooks/use-form-tab";
import { useFormTabStore } from "@/lib/hooks/store";
import { FormTab } from "@/lib/types";
import { OrderHistoryTrigger } from "./order-history-trigger";
import { StyledSelect } from "./ui/styled-select";
import { SegmentedTabs } from "./ui/tabs";

const FormHeader = () => {
  const { selectedTab, setSelectedTab } = useSelectedFormTab();

  return (
    <div data-form-header className="flex items-center">
      <div className="min-w-0 flex-1 sm:hidden">
        <StyledSelect
          value={selectedTab.value}
          onValueChange={setSelectedTab}
          options={FORM_TABS.map((tab) => ({
            value: tab.value,
            label: tab.fullLabel,
          }))}
        />
      </div>
      <SegmentedTabs
        aria-label="Order type"
        value={selectedTab.value}
        options={FORM_TABS.map((tab) => ({
          value: tab.value,
          label: tab.label,
          title: tab.fullLabel,
        }))}
        onValueChange={setSelectedTab}
      />
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
      className="flex min-h-11 items-center justify-between gap-3 px-1"
    >
      <h2 className="min-w-0 truncate text-[18px] font-bold leading-none text-foreground">
        {title}
      </h2>
      {showOrderHistory && <OrderHistoryTrigger onOpen={onOpenOrderHistory} />}
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
  const openOrderHistory = React.useCallback(() => {
    setOrderHistoryOpen(true);
  }, [setOrderHistoryOpen]);

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
          showOrderHistory={selectedTab.value !== FormTab.SWAP}
        />
        {children}
      </div>
      <PoweredBy />
    </div>
  );
}
