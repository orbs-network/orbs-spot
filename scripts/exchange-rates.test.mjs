import assert from "node:assert/strict";
import test from "node:test";
import BN from "bignumber.js";
import { formatExchangeRate, getExchangeRates, getExchangeRatesFromPrice } from "../lib/exchange-rates.ts";

test("rates show both directions from raw quote amounts and token decimals", () => {
  const rates = getExchangeRates({ inAmount: "2000000000000000000", outAmount: "27229000000", inputDecimals: 18, outputDecimals: 6 });
  assert.ok(rates);
  assert.equal(formatExchangeRate(rates.forward), "13,614.5");
  assert.equal(formatExchangeRate(rates.reverse), "0.000073451");
  assert.ok(rates.forward.times(rates.reverse).minus(1).abs().lt("1e-500"));
});

test("precision adapts to magnitude without hiding small rates", () => {
  for (const [value, expected] of [
    ["13614.56789", "13,614.6"], ["1361.45678", "1,361.46"],
    ["2369.1691", "2,369.17"], ["236916.91", "236,917"],
    ["13.6145678", "13.6146"], ["1.36145678", "1.36146"],
    ["0.000424813", "0.00042481"], ["0.00007345123456", "0.000073451"],
    ["0.000000000000000000123456789", "0.00000000000000000012346"],
    ["1234567.89", "1,234,568"], ["0", "—"], ["NaN", "—"],
  ]) assert.equal(formatExchangeRate(BN(value)), expected);
  const tiny = getExchangeRates({ inAmount: "1000000000000000000000000000000", outAmount: "1", inputDecimals: 18, outputDecimals: 18 });
  assert.equal(formatExchangeRate(tiny.forward), "0.000000000000000000000000000001");
});

test("direct order prices use the same formatting and retain reciprocal precision", () => {
  const rates = getExchangeRatesFromPrice("2369.1691");
  assert.ok(rates);
  assert.equal(formatExchangeRate(rates.forward), "2,369.17");
  assert.equal(formatExchangeRate(rates.reverse), "0.00042209");
  assert.ok(rates.forward.times(rates.reverse).minus(1).abs().lt("1e-500"));
  assert.equal(formatExchangeRate(getExchangeRatesFromPrice("1e-30").reverse), "1,000,000,000,000,000,000,000,000,000,000");
  for (const value of [undefined, "", "0", "-1", "NaN", "Infinity"]) {
    assert.equal(getExchangeRatesFromPrice(value), undefined);
  }
});

test("invalid quotes do not produce zero or infinite rate labels", () => {
  const quote = { inAmount: "1", outAmount: "1", inputDecimals: 18, outputDecimals: 6 };
  for (const invalid of [
    { inAmount: "0" }, { outAmount: "0" }, { inAmount: "-1" }, { outAmount: "NaN" },
    { inAmount: "1.5" }, { inputDecimals: undefined }, { outputDecimals: -1 }, { outputDecimals: 256 },
  ]) assert.equal(getExchangeRates({ ...quote, ...invalid }), undefined);
});
