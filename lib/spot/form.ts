import { OrderType, type CalculateOrderFormParams } from "@orbs-network/spot-ui";

export function getOrderDraftKey(chainId: number, orderType: OrderType, inputToken?: string, outputToken?: string) {
  return `${chainId}:${orderType}:${inputToken}:${outputToken}`;
}

export function usesMarketPrice(orderType: OrderType, limitPriceEnabled: boolean) {
  return orderType !== OrderType.LIMIT && !limitPriceEnabled;
}

/** Editable values only. Amounts, defaults, validation and schedules come from calculateOrder. */
export type OrderInput = Partial<
  Omit<CalculateOrderFormParams["userInput"], "inputAmountUi">
>;
