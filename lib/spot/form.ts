import type { CalculateOrderFormParams } from "@orbs-network/spot-ui";

/** Editable values only. Amounts, defaults, validation and schedules come from calculateOrderForm. */
export type OrderInput = Partial<
  Omit<CalculateOrderFormParams["userInput"], "inputAmountUi">
>;
