import { calculateOrderForm, Module, type CalculatedOrderForm, type CalculateOrderFormParams, type SpotClient, type RePermitData } from "@orbs-network/spot-ui";
import type { useDeveloperOrder } from "../advanced-order/use-developer-order";
import BN from "bignumber.js";
import type { JsonContainer, JsonValidationIssue } from "./json-inspector";

type SpotData = ReturnType<typeof useDeveloperOrder>;

export function getLiveOrderFormInput(spot: SpotData): JsonContainer {
  const data = spot.derivedFormData;
  const unitPrice = (usd: string, amount: string) => {
    const value = new BN(usd).div(amount);
    return value.isFinite() && value.gt(0) ? value.toFixed() : "0";
  };
  const params: CalculateOrderFormParams = {
    module: spot.module,
    inputTokenDecimals: data.srcToken?.decimals ?? 18,
    outputTokenDecimals: data.dstToken?.decimals ?? 18,
    quotedOutputAmountRaw: new BN(data.form.marketPrice.raw || "0").times(data.srcAmountUI || "0").toFixed(0),
    inputTokenUsdPrice: unitPrice(data.srcAmountUsd, data.srcAmountUI),
    outputTokenUsdPrice: unitPrice(data.dstAmountUsd, data.dstAmountUI),
    minTradeSizeUsd: 5,
    priceProtectionPercent: data.form.values.slippageBps / 100,
    displayFeePercent: data.feesPercentage,
    userInput: {
      inputAmountUi: data.srcAmountUI,
      isMarketOrder: data.form.values.isMarketOrder,
      tradeCount: data.totalTrades,
      tradeInterval: spot.fillDelayPanel.fillDelay,
      orderDuration: spot.durationPanel.duration,
      limitPriceUi: data.limitPriceUI,
      triggerPriceUi: data.triggerPriceUI,
      isPriceInverted: false,
    },
  };
  return JSON.parse(JSON.stringify({ formParams: params })) as JsonContainer;
}

function readParams(data: JsonContainer): CalculateOrderFormParams {
  if (Array.isArray(data) || !data.formParams || Array.isArray(data.formParams) || typeof data.formParams !== "object") {
    throw new Error("Order calculation inputs are missing.");
  }
  const params = data.formParams;
  if (!Object.values(Module).some((module) => module === params.module)) {
    throw new Error("Select a supported order module.");
  }
  for (const key of ["inputTokenDecimals", "outputTokenDecimals", "minTradeSizeUsd", "priceProtectionPercent", "displayFeePercent"] as const) {
    if (typeof params[key] !== "number" || !Number.isFinite(params[key]) || params[key] < 0) {
      throw new Error(`${key} must be a non-negative number.`);
    }
  }
  for (const key of ["inputTokenDecimals", "outputTokenDecimals"] as const) {
    if (!Number.isInteger(params[key]) || Number(params[key]) > 255) throw new Error(`${key} must be an integer between 0 and 255.`);
  }
  // The editor preserves the shape and primitive types of these generated inputs.
  return params as unknown as CalculateOrderFormParams;
}

export function calculateEditedOrderForm(data: JsonContainer): CalculatedOrderForm {
  const form = calculateOrderForm(readParams(data));
  if (!form.canSubmit) {
    const errors = form.errors.all.map((error) => error.type).join(", ");
    throw new Error(`Resolve the calculation inputs before saving: ${errors || "form is not ready"}.`);
  }
  return form;
}

export function validateOrderFormInput(data: JsonContainer): JsonValidationIssue[] {
  try {
    calculateEditedOrderForm(data);
    return [];
  } catch (error) {
    return [{ message: error instanceof Error ? error.message : "Invalid order calculation inputs." }];
  }
}

export function rebuildCalculatedPermit(permitData: RePermitData, form: CalculatedOrderForm, account: string, client: SpotClient): RePermitData {
  const prepared = client.prepareOrder({
    form,
    inputTokenAddress: permitData.order.permitted.token,
    outputTokenAddress: permitData.order.witness.output.token,
    swapperAddress: account,
  });
  return { ...client.rePermitData, order: prepared.order };
}
