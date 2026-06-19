"use client";

import { AdvancedOrderForm } from "@/components/advanced-order-form";
import { SwapBestTradeForm } from "@/components/best-trade-form";
import { FormContainer } from "@/components/form-container";
import { useSelectedFormTab } from "@/lib/hooks/use-form-tab";
import { FormTab } from "@/lib/types";
import { useState } from "react";

export function TradingForm() {
  const { selectedTab } = useSelectedFormTab();
  const [orderHistoryOpen, setOrderHistoryOpen] = useState(false);

  return (
    <FormContainer
      orderHistoryOpen={orderHistoryOpen}
      onOrderHistoryOpenChange={setOrderHistoryOpen}
    >
      <div key={selectedTab.value}>
        {selectedTab.value === FormTab.SWAP ? (
          <SwapBestTradeForm />
        ) : (
          <AdvancedOrderForm
            orderHistoryOpen={orderHistoryOpen}
            onOrderHistoryOpenChange={setOrderHistoryOpen}
            tab={selectedTab.value}
          />
        )}
      </div>
    </FormContainer>
  );
}
