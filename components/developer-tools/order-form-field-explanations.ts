import type { JsonValuePath } from "./json-inspector";

const FIELD_EXPLANATIONS: Record<string, string> = {
  formParams: "Inputs passed to calculateOrderForm. The SDK derives validated amounts, prices, and a schedule from these values. Saving rebuilds the live order’s RePermit data.",
  "formParams.module": "Order strategy: TWAP, LIMIT, STOP_LOSS, or TAKE_PROFIT. This follows the selected order type and is read-only here.",
  "formParams.inputTokenDecimals": "Decimal precision of the input token. For example, an 18-decimal token uses 10^18 base units per whole token. This comes from the selected token and is read-only.",
  "formParams.outputTokenDecimals": "Decimal precision of the output token, used to convert quoted and minimum output amounts between base units and display values. This is read-only.",
  "formParams.quotedOutputAmountRaw": "Quoted output for the complete input amount, expressed as an integer in output-token base units. Update it when the input amount or token pair changes; it is not a one-token price.",
  "formParams.inputTokenUsdPrice": "USD price of one whole input token, as a decimal string. The SDK uses it to calculate input value and validate the minimum value per trade.",
  "formParams.outputTokenUsdPrice": "USD price of one whole output token, as a decimal string. Used for output-value and price displays.",
  "formParams.minTradeSizeUsd": "Minimum USD value for each individual trade. The SDK uses this to validate the trade count and calculate its maximum. Use the minimum agreed for this integration.",
  "formParams.priceProtectionPercent": "Execution price protection in percentage units: 3 means 3%, or 300 basis points in RePermit. This is separate from the regular swap slippage setting.",
  "formParams.displayFeePercent": "Fee percentage used only to display an estimated fee. It does not collect a fee or subtract it from the order’s amounts.",
  "formParams.inputBalanceRaw": "Available input-token balance as an integer in token base units. When supplied, the SDK checks that the order amount does not exceed this balance.",
  "formParams.userInput": "Editable order choices, including amount, execution mode, trade count, schedule, and prices. These are combined with the market and token inputs above.",
  "formParams.userInput.inputAmountUi": "Total input amount in whole-token display units, such as 1.5. The SDK converts it to base units and divides it across the trades. Update the complete-amount quote when changing this value.",
  "formParams.userInput.isMarketOrder": "Whether the strategy uses market execution rather than a specified limit price. A LIMIT order remains a limit order regardless of this flag.",
  "formParams.userInput.tradeCount": "Number of individual fills for a TWAP order. The SDK divides the total amount across these trades and checks each against the minimum trade size. Other strategies use a single trade.",
  "formParams.userInput.tradeInterval": "Time between TWAP fills, expressed as a value and a time unit. It becomes the RePermit epoch in seconds; single-trade orders use an epoch of zero.",
  "formParams.userInput.tradeInterval.value": "Number of time units between fills. For example, value 5 with unit 60000 means a five-minute interval.",
  "formParams.userInput.tradeInterval.unit": "Time unit in milliseconds, using the SDK’s TimeUnit values: 60000 for minutes, 3600000 for hours, or 86400000 for days. Multiply by value to get the interval.",
  "formParams.userInput.orderDuration": "How long the order can remain active, expressed as a value and a time unit. The SDK derives its deadline when preparing the order and adds a 60-second buffer.",
  "formParams.userInput.orderDuration.value": "Number of time units the order remains active. For example, value 12 with unit 3600000 means twelve hours. The duration must accommodate the trade schedule.",
  "formParams.userInput.orderDuration.unit": "Time unit in milliseconds for the order duration: 60000 for minutes, 3600000 for hours, or 86400000 for days. Multiply by value to get the duration.",
  "formParams.userInput.limitPriceUi": "Limit execution price as a decimal string in the selected price direction. Normally this is output tokens per input token; isPriceInverted reverses it. An empty value lets the SDK derive the price from its defaults or percentage setting.",
  "formParams.userInput.limitPricePercent": "Percentage offset used to derive the limit price when no explicit limitPriceUi is supplied. An explicit price takes precedence.",
  "formParams.userInput.triggerPriceUi": "Price that activates a stop-loss or take-profit order, in the selected display direction. The SDK converts it to the RePermit trigger bound. It is separate from the execution limit price.",
  "formParams.userInput.triggerPricePercent": "Percentage offset used to derive the trigger price when no explicit triggerPriceUi is supplied. An explicit trigger price takes precedence.",
  "formParams.userInput.isPriceInverted": "When false, displayed prices are output tokens per input token; when true, they are input tokens per output token. The SDK converts both directions into canonical protocol prices.",
};

export function getOrderFormFieldExplanation(path: JsonValuePath): string | undefined {
  return FIELD_EXPLANATIONS[path.join(".")];
}
