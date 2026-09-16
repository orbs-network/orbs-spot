import {
  getOrderExecutionRate,
  getOrderFillDelayMillis,
  getOrderLimitPriceRate,
  getTriggerPriceRate,
  toAmountUI,
  toAmountRaw,
  type Config,
  type Order,
  type Token,
} from "@orbs-network/spot-ui";

/** Pure display mapping. Keep protocol IDs for cancellation and historyKey for identity. */
export function describeOrder(
  order: Order,
  inputToken?: Token,
  outputToken?: Token,
  legacyConfig?: Config,
) {
  // Preserve raw strings for protocol operations. Without token decimals, leave
  // the display blank instead of guessing a conversion (tokens do not all use 18).
  const amount = (raw: string, token?: Token) => ({
    raw,
    ui: token ? toAmountUI(raw, token.decimals) : "",
  });
  const rate = (value: string) => ({
    raw: outputToken ? toAmountRaw(value, outputToken.decimals) : "",
    ui: value,
  });
  const rateFor = (input: string, output: string) =>
    inputToken && outputToken
      ? getOrderExecutionRate(
          input,
          output,
          inputToken.decimals,
          outputToken.decimals,
        )
      : "";
  return {
    original: order,
    id: order.id,
    version: order.version,
    inputToken,
    outputToken,
    orderType: order.type,
    createdAt: order.createdAt,
    deadline: order.deadline,
    totalTrades: order.totalTradesAmount,
    tradeInterval: getOrderFillDelayMillis(order, legacyConfig),
    inputAmount: amount(order.srcAmount, inputToken),
    inputAmountPerTrade: amount(order.srcAmountPerTrade, inputToken),
    minOutputAmountPerTrade: amount(order.dstMinAmountPerTrade, outputToken),
    inputAmountFilled: amount(order.srcAmountFilled, inputToken),
    outputAmountFilled: amount(order.dstAmountFilled, outputToken),
    progress: order.progress,
    executionPrice: rate(rateFor(order.srcAmountFilled, order.dstAmountFilled)),
    limitPrice: rate(
      inputToken && outputToken && !order.isMarketPrice
        ? getOrderLimitPriceRate(
            order,
            inputToken.decimals,
            outputToken.decimals,
          )
        : "",
    ),
    triggerPrice: rate(
      inputToken && outputToken
        ? getTriggerPriceRate(order, inputToken.decimals, outputToken.decimals)
        : "",
    ),
    fills: order.fills.map((fill) => ({
      rawFill: fill,
      inputToken,
      outputToken,
      inputAmount: amount(fill.inAmount, inputToken),
      outputAmount: amount(fill.outAmount, outputToken),
      timestamp: fill.timestamp,
      txHash: fill.txHash,
      executionRate: rateFor(fill.inAmount, fill.outAmount),
    })),
  };
}
