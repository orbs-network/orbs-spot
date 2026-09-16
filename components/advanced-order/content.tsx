"use client";

import { memo } from "react";
import { FormActionPanel } from "@/components/form-action-panel";
import { OrderHistoryModal } from "@/components/order-history-modal";
import { SettingsModal } from "@/components/settings-modal";
import { ToggleCurrencies } from "@/components/toggle-currencies";
import { useFormTabStore } from "@/lib/hooks/store";
import { Module } from "@orbs-network/spot-ui";
import { DisclaimerPanel, InputErrorPanel } from "./feedback-panels";
import { ModuleInputs, TokenPanel } from "./token-panels";
import { PricesPanel } from "./price-panels";
import { SubmitOrder } from "./submit-order";

export const AdvancedOrderContent = memo(function AdvancedOrderContent({
  orderModule,
}: {
  orderModule: Module;
}) {
  const orderHistoryOpen = useFormTabStore((state) => state.orderHistoryOpen);
  const setOrderHistoryOpen = useFormTabStore(
    (state) => state.setOrderHistoryOpen,
  );

  return (
    <>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <TokenPanel isSource />
          <ToggleCurrencies />
          <TokenPanel isSource={false} />
        </div>
        <PricesPanel orderModule={orderModule} />
        <ModuleInputs orderModule={orderModule} />
        <InputErrorPanel />
        <FormActionPanel>
          <SettingsModal triggerVariant="action" />
          <SubmitOrder orderModule={orderModule} />
        </FormActionPanel>
        <DisclaimerPanel />
      </div>
      <OrderHistoryModal
        open={orderHistoryOpen}
        onOpenChange={setOrderHistoryOpen}
      />
    </>
  );
});
