"use client";

import { AdvancedOrderForm } from "@/components/advanced-order-form";
import { SwapBestTradeForm } from "@/components/best-trade-form";
import { FormContainer } from "@/components/form-container";
import { useSelectedFormTab } from "@/lib/hooks/use-form-tab";
import { FormTab } from "@/lib/types";

export function TradingForm() {
  const { selectedTab } = useSelectedFormTab();

  return (
    <FormContainer>
      <div key={selectedTab.value}>
        {selectedTab.value === FormTab.SWAP ? (
          <SwapBestTradeForm />
        ) : (
          <AdvancedOrderForm tab={selectedTab.value} />
        )}
      </div>
    </FormContainer>
  );
}
