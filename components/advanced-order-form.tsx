"use client";

import { useSelectedFormTab } from "@/lib/hooks/use-form-tab";
import { AdvancedOrderContent } from "./advanced-order/content";
import {
  OrderFormContext,
  useCalculatedOrder,
} from "./advanced-order/use-order-form";
import { getOrderType } from "./advanced-order/utils";

export function AdvancedOrderForm() {
  const { selectedTab } = useSelectedFormTab();

  const model = useCalculatedOrder(getOrderType(selectedTab.value));

  return (
    <OrderFormContext.Provider value={model}>
      <AdvancedOrderContent />
    </OrderFormContext.Provider>
  );
}
