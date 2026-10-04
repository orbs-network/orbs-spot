"use client";

import { AdvancedOrderForm } from "@/components/advanced-order-form";
import { SwapBestTradeForm } from "@/components/best-trade-form";
import { FormContainer } from "@/components/form-container";
import { useSelectedFormTab } from "@/lib/hooks/use-form-tab";
import { OrderHistoryModal } from "@/components/order-history-modal";
import { TradingSidebar } from "@/components/trading-sidebar";
import { useFormTabStore } from "@/lib/hooks/store";
import { IS_ORBS } from "@/lib/partners/client";
import { FormTab } from "@/lib/types";

export function TradingForm() {
  const { selectedTab } = useSelectedFormTab();
  const isSwapTab = selectedTab.value === FormTab.SWAP;

  const historyOpen = useFormTabStore((state) => state.orderHistoryOpen);
  const setHistoryOpen = useFormTabStore((state) => state.setOrderHistoryOpen);

  return (
    <>
      {IS_ORBS && <TradingSidebar />}
      <FormContainer>
        <div className={isSwapTab ? "block" : "hidden"}>
          <SwapBestTradeForm />
        </div>
        {/* Its draft lives in the store, so unmounting does not discard edits. */}
        {!isSwapTab && <AdvancedOrderForm />}
      </FormContainer>
      {!IS_ORBS && (!isSwapTab || historyOpen) && (
        <OrderHistoryModal open={historyOpen} onOpenChange={setHistoryOpen} />
      )}
    </>
  );
}
