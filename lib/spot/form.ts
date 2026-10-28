import { Module, type CalculateOrderFormParams } from "@orbs-network/spot-ui";

export function getOrderDraftKey(chainId: number, module: Module, inputToken?: string, outputToken?: string) {
  return `${chainId}:${module}:${inputToken}:${outputToken}`;
}

export function usesMarketPrice(module: Module, limitPriceEnabled: boolean) {
  return module !== Module.LIMIT && !limitPriceEnabled;
}

/** Editable values only. Amounts, defaults, validation and schedules come from calculateOrder. */
export type OrderInput = Partial<
  Omit<CalculateOrderFormParams["userInput"], "inputAmountUi">
>;
