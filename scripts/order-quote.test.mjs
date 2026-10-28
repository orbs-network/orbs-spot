import assert from "node:assert/strict";
import test from "node:test";
import { calculateOrder, Module } from "@orbs-network/spot-ui";
import { getLiveOrderFormInput } from "../features/developer-tools/order-form-calculation.ts";

const modules = [Module.TWAP, Module.LIMIT, Module.STOP_LOSS, Module.TAKE_PROFIT];
const formParams = orderModule => ({
  module: orderModule, inputTokenDecimals: 18, outputTokenDecimals: 6,
  inputTokenUsdPrice: "2000", outputTokenUsdPrice: "1", minTradeSizeUsd: 10,
  quotedOutputAmountRaw: "74000000", priceProtectionPercent: 3,
  userInput: { inputAmountUi: "2", isMarketOrder: orderModule !== Module.LIMIT },
});

function preview(orderModule, quotedOutputAmountRaw) {
  const form = calculateOrder(formParams(orderModule));
  return getLiveOrderFormInput({
    module: orderModule,
    derivedFormData: {
      form, quotedOutputAmountRaw, srcToken: { decimals: 18 }, dstToken: { decimals: 6 },
      srcAmountUI: "2", srcAmountUsd: "4000", dstAmountUI: "74", dstAmountUsd: "74",
      totalTrades: form.trades.amount, feesPercentage: 0,
    },
    fillDelayPanel: { fillDelay: form.schedule.fillDelay },
    durationPanel: { duration: form.schedule.duration },
  }).formParams;
}

test("all advanced modules derive market rate from the complete quote independently of USD valuation", () => {
  for (const orderModule of modules) {
    const form = calculateOrder(formParams(orderModule));
    assert.equal(form.marketPrice.ui, "37", orderModule);
    assert.equal(form.isReady, true, orderModule);
    const missing = calculateOrder({ ...formParams(orderModule), quotedOutputAmountRaw: undefined });
    assert.equal(missing.isReady, false, orderModule);
    assert.equal(missing.canSubmit, false, orderModule);
  }
});

test("developer calculation preserves the full raw quote without reconstructing from market rate or USD", () => {
  const exactRawQuote = "123456789012345678901234567890";
  for (const orderModule of modules) {
    assert.equal(preview(orderModule, exactRawQuote).quotedOutputAmountRaw, exactRawQuote, orderModule);
    assert.equal("quotedOutputAmountRaw" in preview(orderModule, undefined), false, orderModule);
  }
});
