"use client";

import { FormActionPanel } from "@/components/form-action-panel";
import { OrderHistoryModal } from "@/components/order-history-modal";
import { SettingsModal } from "@/components/settings-modal";
import { ToggleCurrencies } from "@/components/toggle-currencies";
import { useFormTabStore } from "@/lib/hooks/store";
import { cn } from "@/lib/utils";
import { Module } from "@orbs-network/spot-react";
import { DisclaimerPanel, InputErrorPanel } from "./feedback-panels";
import { ModuleInputs, TokenPanel } from "./token-panels";
import { PricesPanel } from "./price-panels";
import { SubmitOrder } from "./submit-order";

export function AdvancedOrderContent({
  hidden,
  orderModule,
}: {
  hidden?: boolean;
  orderModule: Module;
}) {
  const orderHistoryOpen = useFormTabStore((state) => state.orderHistoryOpen);
  const setOrderHistoryOpen = useFormTabStore(
    (state) => state.setOrderHistoryOpen,
  );

  return (
    <>
      <div
        aria-hidden={hidden}
        className={cn("flex flex-col gap-3", hidden && "hidden")}
      >
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
}

