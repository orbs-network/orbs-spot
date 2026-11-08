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

function preview(orderModule, quotedOutputAmountRaw, overrides = {}) {
  const form = calculateOrder(formParams(orderModule));
  return getLiveOrderFormInput({
    module: orderModule,
    derivedFormData: {
      form, quotedOutputAmountRaw, srcToken: { decimals: 18 }, dstToken: { decimals: 6 },
      srcAmountUI: "2", srcAmountUsd: "4000.000000000000000001", dstAmountUI: "74", dstAmountUsd: "74",
      quoteUsd: {
        inputAmountUsd: "4000.000000000000000001", outputAmountUsd: "73.123456789012345678",
        minimumAmountOutUsd: "72.000000000000000001",
        inputTokenUsdPrice: "2000.0000000000000000005", outputTokenUsdPrice: "0.988154821473139806459459459459",
      },
      totalTrades: form.trades.amount, feesPercentage: 0,
      ...overrides,
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

test("developer calculation preserves quoted USD totals and prices independently of an edited limit", () => {
  for (const orderModule of modules) {
    const params = preview(orderModule, "74000000", { dstAmountUI: "100", dstAmountUsd: "98.81", limitPriceUI: "50" });
    assert.equal(params.inputAmountUsd, "4000.000000000000000001", orderModule);
    assert.equal(params.quotedOutputAmountUsd, "73.123456789012345678", orderModule);
    assert.equal(params.minimumOutputAmountUsd, "72.000000000000000001", orderModule);
    assert.equal(params.inputTokenUsdPrice, "2000.0000000000000000005", orderModule);
    assert.equal(params.outputTokenUsdPrice, "0.988154821473139806459459459459", orderModule);
    assert.equal(params.userInput.limitPriceUi, "50", orderModule);
    assert.equal(params.minTradeSizeUsd, 10, orderModule);
    assert.equal(calculateOrder(params).inputAmount.usd, "4000.000000000000000001", orderModule);
  }
});

test("a frozen developer review retains its USD snapshot when live quote metadata is unavailable", () => {
  const params = preview(Module.LIMIT, "74000000", { quoteUsd: undefined, srcAmountUsd: "4000", dstAmountUI: "100", dstAmountUsd: "99" });
  assert.equal(params.inputAmountUsd, "4000");
  assert.equal(params.inputTokenUsdPrice, "2000");
  assert.equal(params.outputTokenUsdPrice, "0.99");
  assert.equal("quotedOutputAmountUsd" in params, false);
  assert.equal("minimumOutputAmountUsd" in params, false);
  const missingUsd = preview(Module.LIMIT, "74000000", { quoteUsd: undefined, srcAmountUsd: "", dstAmountUsd: "" });
  assert.equal("inputAmountUsd" in missingUsd, false);
  assert.equal("inputTokenUsdPrice" in missingUsd, false);
  assert.equal("outputTokenUsdPrice" in missingUsd, false);
});

test("developer calculation preserves the full raw quote without reconstructing from market rate or USD", () => {
  const exactRawQuote = "123456789012345678901234567890";
  for (const orderModule of modules) {
    assert.equal(preview(orderModule, exactRawQuote).quotedOutputAmountRaw, exactRawQuote, orderModule);
    assert.equal("quotedOutputAmountRaw" in preview(orderModule, undefined), false, orderModule);
  }
});
