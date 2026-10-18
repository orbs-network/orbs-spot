"use client";

import { AdvancedOrderForm } from "@/components/advanced-order-form";
import { SwapBestTradeForm } from "@/components/best-trade-form";
import { FormContainer } from "@/components/form-container";
import { useSelectedFormTab } from "@/lib/hooks/use-form-tab";
import { FormTab } from "@/lib/types";
import { DisclaimerPanel } from "@/components/advanced-order/feedback-panels";
import { useNativeConversion } from "@/lib/hooks/use-native-conversion";

export function TradingForm() {
  const { selectedTab } = useSelectedFormTab();
  const isSwapTab = selectedTab.value === FormTab.SWAP;
  const nativeConversion = useNativeConversion();
  const showSwapForm = isSwapTab || Boolean(nativeConversion);

  return (
    <FormContainer footer={!showSwapForm ? <DisclaimerPanel /> : undefined}>
      <div className={showSwapForm ? "block" : "hidden"}>
        <SwapBestTradeForm />
      </div>
      {/* Its draft lives in the store, so unmounting does not discard edits. */}
      {!showSwapForm && <AdvancedOrderForm />}
    </FormContainer>
  );
}
