"use client";

import type { HistoryOrder } from "@/lib/spot/order-tokens";
import { useHistoryOrder } from "@/components/advanced-order/use-order-client";
import { useOrderCurrency } from "./use-order-currency";

export function useOrderDisplay(order: HistoryOrder) {
  const input = useOrderCurrency(order.srcTokenAddress, order.chainId, order.inputToken);
  const output = useOrderCurrency(order.dstTokenAddress, order.chainId, order.outputToken);
  const details = useHistoryOrder(order, input.currency, output.currency);
  return { inputToken: input.currency, outputToken: output.currency, inputLoading: input.isLoading, outputLoading: output.isLoading, details };
}
