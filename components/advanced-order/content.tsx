"use client";

import { FormActionPanel } from "@/components/form-action-panel";
import { ToggleCurrencies } from "@/components/toggle-currencies";
import { Module } from "@orbs-network/spot-ui";
import { InputErrorPanel } from "./feedback-panels";
import { ModuleInputs, TokenPanel } from "./token-panels";
import { PricesPanel } from "./price-panels";
import { AdvancedOrderSummary } from "./summary";
import { SubmitOrder } from "./submit-order";
import { useOutputAmount } from "./use-order-form";

export function AdvancedOrderContent({
  orderModule,
}: {
  orderModule: Module;
}) {
  const { amount } = useOutputAmount();
  return (
    <div data-advanced-order-content className="flex flex-col gap-2.5">
      <div data-currency-pair className="flex flex-col gap-1.5">
        <TokenPanel isSource />
        <ToggleCurrencies outputAmount={amount.ui} />
        <TokenPanel isSource={false} />
      </div>
      <PricesPanel orderModule={orderModule} />
      <ModuleInputs orderModule={orderModule} />
      <InputErrorPanel />
      <FormActionPanel>
        <SubmitOrder orderModule={orderModule} />
      </FormActionPanel>
      <AdvancedOrderSummary />
    </div>
  );
}
