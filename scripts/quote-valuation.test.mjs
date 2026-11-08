import assert from "node:assert/strict";
import test from "node:test";
import { calculateOrder, Module } from "@orbs-network/spot-ui";
import BN from "bignumber.js";
import { assertMinimumQuoteValue, getQuoteValuation } from "../lib/swap/quote-valuation.ts";
import { formatDisplayAmount } from "../lib/token-display.ts";

const quote = {
  inAmount: "2000000000000000000", outAmount: "74000000", minAmountOut: "70000000",
  originalQuote: { inputAmountUsd: "200", netAmountOutUsd: "148", minimumAmountOutUsd: "139.25", priceImpactPercentage: "-20" },
};

const formParams = (quoted, values, orderModule = Module.TWAP) => ({
  module: orderModule, inputTokenDecimals: 18, outputTokenDecimals: 6,
  quotedOutputAmountRaw: quoted.outAmount,
  minimumOutputAmountRaw: quoted.minAmountOut,
  inputAmountUsd: values.inputAmountUsd,
  quotedOutputAmountUsd: values.outputAmountUsd,
  minimumOutputAmountUsd: values.minimumAmountOutUsd,
  inputTokenUsdPrice: values.inputTokenUsdPrice,
  outputTokenUsdPrice: values.outputTokenUsdPrice,
  minTradeSizeUsd: 10,
  userInput: { inputAmountUi: "2", isMarketOrder: true },
});

test("quote input and output USD stay distinct without changing advanced execution rates", () => {
  const values = getQuoteValuation(quote, 18, 6);
  assert.equal(values.inputAmountUsd, "200");
  assert.equal(values.outputAmountUsd, "148");
  assert.equal(values.minimumAmountOutUsd, "139.25");
  for (const orderModule of [Module.TWAP, Module.LIMIT, Module.STOP_LOSS, Module.TAKE_PROFIT]) {
    const form = calculateOrder(formParams(quote, values, orderModule));
    assert.equal(form.inputAmount.usd, "200", orderModule);
    // Trigger orders can estimate a different receive amount at their trigger price.
    assert.equal(form.outputAmount.usd, BN(form.outputAmount.ui).times(2).toFixed(), orderModule);
    assert.equal(form.marketPrice.ui, "37", orderModule);
    assert.equal(form.isReady, true, orderModule);
  }
});

test("missing input USD stays unavailable rather than falling back to available output USD", () => {
  assert.deepEqual(getQuoteValuation(), {});
  for (const inputAmountUsd of [undefined, "", "NaN", "Infinity", "-1"]) {
    const missing = { ...quote, originalQuote: { ...quote.originalQuote, inputAmountUsd } };
    const values = getQuoteValuation(missing, 18, 6);
    assert.equal(values.inputAmountUsd, undefined);
    assert.equal(values.outputAmountUsd, "148");
    assert.equal(values.inputTokenUsdPrice, undefined);
    assert.equal(values.outputTokenUsdPrice, "2");
    assert.equal(values.minimumAmountOutUsd, "139.25");
    assert.throws(() => assertMinimumQuoteValue(missing, 10), /at least \$10/);
    assert.equal(calculateOrder(formParams(missing, values)).isReady, false);
  }
});

test("missing output USD does not discard available input USD or invent output dollar values", () => {
  const missing = { ...quote, originalQuote: { inputAmountUsd: "200" } };
  const values = getQuoteValuation(missing, 18, 6);
  assert.equal(values.inputAmountUsd, "200");
  assert.equal(values.inputTokenUsdPrice, "100");
  assert.equal(values.outputAmountUsd, undefined);
  assert.equal(values.outputTokenUsdPrice, undefined);
  assert.equal(values.minimumAmountOutUsd, undefined);
  assert.doesNotThrow(() => assertMinimumQuoteValue(missing, 10));
  const form = calculateOrder(formParams(missing, values));
  assert.equal(form.isReady, true);
  assert.equal(form.outputAmount.usd, "");
});

test("minimum validation uses exact input USD even when output USD is on the other side of $10", () => {
  const valued = inputAmountUsd => ({ ...quote, originalQuote: { inputAmountUsd, netAmountOutUsd: "100" } });
  assert.throws(() => assertMinimumQuoteValue(valued("9.999999999999999999"), 10), /at least \$10/);
  assert.doesNotThrow(() => assertMinimumQuoteValue(valued("10"), 10));
  assert.doesNotThrow(() => assertMinimumQuoteValue(valued("10.000000000000000001"), 10));
  assert.doesNotThrow(() => assertMinimumQuoteValue({ ...quote, originalQuote: { inputAmountUsd: "10", netAmountOutUsd: "9" } }, 10));
  const zero = getQuoteValuation(valued("0"), 18, 6);
  assert.equal(zero.inputAmountUsd, "0");
  assert.equal(zero.inputTokenUsdPrice, undefined);
  assert.throws(() => assertMinimumQuoteValue(valued("0"), 10));
});

test("SDK calculations retain exact totals at recurring unit prices and trade-size boundaries", () => {
  const tiny = getQuoteValuation({ ...quote, inAmount: "100000000000000000000000000", originalQuote: { inputAmountUsd: "100" } }, 0, 6);
  assert.equal(tiny.inputTokenUsdPrice, "0.000000000000000000000001");
  for (const inputAmountUsd of ["10", "100"]) {
    const values = getQuoteValuation({ ...quote, inAmount: "3", originalQuote: { inputAmountUsd, netAmountOutUsd: "9" } }, 0, 6);
    const form = calculateOrder({
      ...formParams(quote, values), inputTokenDecimals: 0,
      userInput: { inputAmountUi: "3", isMarketOrder: true },
    });
    assert.equal(form.inputAmount.usd, inputAmountUsd);
    assert.equal(form.errors.minTradeSize, undefined);
    assert.equal(form.trades.maxTrades, Number(inputAmountUsd) / 10);
    assert.equal(formatDisplayAmount(form.inputAmount.usd, { decimalScale: 2, prefix: "$" }), `$${inputAmountUsd}`);
    assert.equal(formatDisplayAmount(form.outputAmount.usd, { decimalScale: 2, prefix: "$" }), "$9");
  }
});

test("swaps retain exact output/minimum USD while edited advanced output uses its quote unit value", () => {
  const values = getQuoteValuation(quote, 18, 6);
  const swap = calculateOrder(formParams(quote, values, Module.SWAP));
  assert.equal(swap.inputAmount.usd, "200");
  assert.equal(swap.outputAmount.usd, "148");
  assert.equal(swap.minOutputAmountTotal.usd, "139.25");
  const params = formParams(quote, values, Module.LIMIT);
  const limit = calculateOrder({ ...params, userInput: { ...params.userInput, isMarketOrder: false, limitPriceUi: "40" } });
  assert.equal(limit.inputAmount.usd, "200");
  assert.equal(limit.outputAmount.ui, "80");
  assert.equal(limit.outputAmount.usd, "160");
});
