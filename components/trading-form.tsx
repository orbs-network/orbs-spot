"use client";

import { AdvancedOrderForm } from "@/components/advanced-order-form";
import { SwapBestTradeForm } from "@/components/best-trade-form";
import { FormContainer } from "@/components/form-container";
import { useSelectedFormTab } from "@/lib/hooks/use-form-tab";
import { FormTab } from "@/lib/types";

export function TradingForm() {
  const { selectedTab } = useSelectedFormTab();
  const isSwapTab = selectedTab.value === FormTab.SWAP;

  return (
    <FormContainer>
      <div className={isSwapTab ? "block" : "hidden"}>
        <SwapBestTradeForm />
      </div>
      {/* Mount calculation and query hooks only while an advanced tab is visible.
          Its draft lives in the store, so unmounting does not discard edits. */}
      {!isSwapTab && <AdvancedOrderForm />}
    </FormContainer>
  );
}
