import { calculateOrderForm, Module, type CalculatedOrderForm, type CalculateOrderFormParams, type RePermitData } from "@orbs-network/spot-ui";
import { buildRePermitOrderData, type useSpot } from "@orbs-network/spot-react";
import BN from "bignumber.js";
import type { JsonContainer, JsonValidationIssue } from "./json-inspector";

type SpotData = ReturnType<typeof useSpot>;

export function getLiveOrderFormInput(spot: SpotData): JsonContainer {
  const data = spot.derivedFormData;
  const unitPrice = (usd: string, amount: string) => {
    const value = new BN(usd).div(amount);
    return value.isFinite() && value.gt(0) ? value.toFixed() : "0";
  };
  const params: CalculateOrderFormParams = {
    module: Module[spot.module],
    inputTokenDecimals: data.srcToken?.decimals ?? 18,
    outputTokenDecimals: data.dstToken?.decimals ?? 18,
    quotedOutputAmountRaw: data.dstAmount || "0",
    inputTokenUsdPrice: unitPrice(data.srcAmountUsd, data.srcAmountUI),
    outputTokenUsdPrice: unitPrice(data.dstAmountUsd, data.dstAmountUI),
    minTradeSizeUsd: 5,
    priceProtectionPercent: (data.rePermitData?.order.witness.slippage ?? 300) / 100,
    displayFeePercent: data.feesPercentage,
    userInput: {
      inputAmountUi: data.srcAmountUI,
      isMarketOrder: data.isMarketOrder ?? false,
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

export function rebuildCalculatedPermit(permitData: RePermitData, form: CalculatedOrderForm, account: string): RePermitData {
  const values = form.values;
  const currentTimeMillis = Number(permitData.order.witness.start) * 1000;
  const result = buildRePermitOrderData({
    permitData,
    chainId: Number(permitData.domain.chainId),
    module: form.module,
    srcTokenAddress: permitData.order.permitted.token,
    dstTokenAddress: permitData.order.witness.output.token,
    swapperAddress: account,
    totalSrcAmount: values.inputAmount,
    srcAmountPerTrade: values.inputAmountPerTrade,
    minDstAmountPerTrade: values.minOutputAmountPerTrade,
    triggerAmountPerTrade: values.triggerOutputAmountPerTrade,
    totalTrades: values.totalTrades,
    fillDelayMillis: values.fillDelayMillis,
    slippageBps: values.slippageBps,
    currentTimeMillis,
    deadlineMillis: currentTimeMillis + values.duration.unit * values.duration.value + 60_000,
  });
  // Keep the fresh nonce from the host rather than rounding it to start seconds.
  result.order.nonce = permitData.order.nonce;
  result.order.witness.nonce = permitData.order.witness.nonce;
  return result;
}
