"use client";

import { useSelectedFormTab } from "@/lib/hooks/use-form-tab";
import { FormTab } from "@/lib/types";
import { AdvancedOrderContent } from "./advanced-order/content";
import {
  OrderFormContext,
  useCalculatedOrder,
} from "./advanced-order/use-order-form";
import { getModule } from "./advanced-order/utils";

export function AdvancedOrderForm() {
  const { selectedTab } = useSelectedFormTab();

  const tab =
    selectedTab.value === FormTab.SWAP ? FormTab.TWAP : selectedTab.value;
  const orderModule = getModule(tab);
  const model = useCalculatedOrder(orderModule);

  return (
    <OrderFormContext.Provider value={model}>
      <AdvancedOrderContent orderModule={orderModule} />
    </OrderFormContext.Provider>
  );
}
