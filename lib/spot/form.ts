import { OrderType, type CalculateOrderFormParams } from "@orbs-network/spot-ui";

export function getOrderDraftKey(chainId: number, module: OrderType, inputToken?: string, outputToken?: string) {
  return `${chainId}:${module}:${inputToken}:${outputToken}`;
}

export function usesMarketPrice(module: OrderType, limitPriceEnabled: boolean) {
  return module !== OrderType.LIMIT && !limitPriceEnabled;
}

/** Editable values only. Amounts, defaults, validation and schedules come from calculateOrder. */
export type OrderInput = Partial<
  Omit<CalculateOrderFormParams["userInput"], "inputAmountUi">
>;
