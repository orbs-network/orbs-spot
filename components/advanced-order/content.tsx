"use client";

import { FormActionPanel } from "@/components/form-action-panel";
import { ToggleCurrencies } from "@/components/toggle-currencies";
import { InputErrorPanel } from "./feedback-panels";
import { OrderSchedule, TokenPanel } from "./token-panels";
import { PricesPanel } from "./price-panels";
import { AdvancedOrderSummary } from "./summary";
import { SubmitOrder } from "./submit-order";
import { useOutputAmount } from "./use-order-form";

export function AdvancedOrderContent() {
  const { amount } = useOutputAmount();
  return (
    <div data-advanced-order-content className="flex flex-col gap-2.5">
      <div data-currency-pair className="flex flex-col gap-1.5">
        <TokenPanel isSource />
        <ToggleCurrencies outputAmount={amount.ui} />
        <TokenPanel isSource={false} />
      </div>
      <PricesPanel />
      <OrderSchedule />
      <InputErrorPanel />
      <FormActionPanel>
        <SubmitOrder />
      </FormActionPanel>
      <AdvancedOrderSummary />
    </div>
  );
}
