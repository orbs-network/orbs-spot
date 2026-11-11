import assert from "node:assert/strict";
import test from "node:test";
import BN from "bignumber.js";
import { calculateOrder, OrderType, InputErrors } from "@orbs-network/spot-ui";
import { registerHooks } from "node:module";

registerHooks({ resolve(specifier, context, nextResolve) {
  return nextResolve(specifier === "./token-display" && context.parentURL?.endsWith("/lib/exchange-rates.ts")
    ? "./token-display.ts" : specifier, context);
} });
const { invertPricePercentage } = await import("../lib/exchange-rates.ts");

const Precise = BN.clone({ DECIMAL_PLACES: 512 });

const calculate = userInput => calculateOrder({
  orderType: OrderType.STOP_LOSS,
  inputTokenDecimals: 18,
  outputTokenDecimals: 18,
  quotedOutputAmountRaw: "1000000000000000000000",
  minTradeSizeUsd: 10,
  priceProtectionPercent: 3,
  userInput: { inputAmountUi: "1", isMarketOrder: false, ...userInput },
});

test("percentage conversion preserves the same economic price when inverted", () => {
  for (const percentage of ["0", "2.5", "-5", "-99.99", "1000"]) {
    const reciprocal = invertPricePercentage(percentage);
    const product = new Precise(percentage).div(100).plus(1).times(new Precise(reciprocal).div(100).plus(1));
    assert.ok(product.minus(1).abs().lt("1e-490"));
    assert.ok(BN(invertPricePercentage(reciprocal)).minus(percentage).abs().lt("1e-480"));
  }
});

test("SDK percentages produce the requested change in the displayed inverted price", () => {
  const displayedPercent = "2.5";
  const form = calculate({ isPriceInverted: true, triggerPricePercent: invertPricePercentage(displayedPercent) });
  const displayedRatio = BN(form.triggerPrice.display.ui).div(BN(1).div(form.marketPrice.ui));
  assert.ok(displayedRatio.minus("1.025").abs().lt("1e-18"));
});

test("empty drafts and invalid percentages never become infinite SDK prices", () => {
  for (const value of [undefined, null, "", "-"]) assert.equal(invertPricePercentage(value), value);
  for (const value of ["-100", "-150"]) {
    assert.equal(invertPricePercentage(value), "-100");
    const form = calculate({ isPriceInverted: true, limitPricePercent: invertPricePercentage(value), triggerPriceUi: "0.0011" });
    assert.equal(form.canSubmit, false);
    assert.equal(form.limitPrice.error?.type, InputErrors.MISSING_LIMIT_PRICE);
  }
});

test("trigger/limit validation follows the original pair in both display directions", () => {
  const normal = calculate({ triggerPriceUi: "950", limitPriceUi: "960" });
  const inverted = calculate({ isPriceInverted: true, triggerPriceUi: BN(1).div(950).toFixed(), limitPriceUi: BN(1).div(960).toFixed() });
  for (const form of [normal, inverted]) {
    assert.equal(form.canSubmit, false);
    assert.equal(form.limitPrice.error?.type, InputErrors.TRIGGER_LIMIT_PRICE_GREATER_THAN_TRIGGER_PRICE);
  }
  assert.equal(calculate({ triggerPriceUi: "950", limitPriceUi: "900" }).limitPrice.error, undefined);
});
