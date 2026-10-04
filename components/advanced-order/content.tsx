"use client";

import { memo } from "react";
import { FormActionPanel } from "@/components/form-action-panel";
import { SettingsModal } from "@/components/settings-modal";
import { ToggleCurrencies } from "@/components/toggle-currencies";
import { Module } from "@orbs-network/spot-ui";
import { DisclaimerPanel, InputErrorPanel } from "./feedback-panels";
import { ModuleInputs, TokenPanel } from "./token-panels";
import { PricesPanel } from "./price-panels";
import { SubmitOrder } from "./submit-order";
import { IS_ORBS } from "@/lib/partners/client";

export const AdvancedOrderContent = memo(function AdvancedOrderContent({
  orderModule,
}: {
  orderModule: Module;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div data-currency-pair className="flex flex-col gap-1.5">
        <TokenPanel isSource />
        <ToggleCurrencies />
        <TokenPanel isSource={false} />
      </div>
      <PricesPanel orderModule={orderModule} />
      <ModuleInputs orderModule={orderModule} />
      <InputErrorPanel />
      <FormActionPanel>
        {!IS_ORBS && <SettingsModal triggerVariant="action" />}
        <SubmitOrder orderModule={orderModule} />
      </FormActionPanel>
      <DisclaimerPanel />
    </div>
  );
});
