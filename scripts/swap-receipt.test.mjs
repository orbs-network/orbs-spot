import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";

registerHooks({ resolve(specifier, context, nextResolve) {
  return nextResolve(specifier === "../token-display" && context.parentURL?.endsWith("/lib/swap/receipt.ts")
    ? "../token-display.ts" : specifier, context);
} });
const { getSwapReceipt } = await import("../lib/swap/receipt.ts");

const quoted = { quotedOutputAmount: "100", quotedOutputAmountUsd: "200", outputDecimals: 6 };

test("a higher fill uses actual tokens and proportionally estimated USD while preserving the quote", () => {
  assert.deepEqual(getSwapReceipt({ ...quoted, receivedAmountRaw: "110000000" }), {
    quotedAmount: "100", receivedAmount: "110", receivedAmountUsd: "220",
    comparison: { direction: "more", quotedAmount: "100", differenceAmount: "10", differencePercent: "10" },
  });
});

test("a lower fill compares actual tokens against the frozen quote", () => {
  assert.deepEqual(getSwapReceipt({ ...quoted, receivedAmountRaw: "90000000" }), {
    quotedAmount: "100", receivedAmount: "90", receivedAmountUsd: "180",
    comparison: { direction: "less", quotedAmount: "100", differenceAmount: "10", differencePercent: "10" },
  });
});

test("an equal fill does not add a quote comparison", () => {
  assert.deepEqual(getSwapReceipt({ ...quoted, receivedAmountRaw: "100000000" }), {
    quotedAmount: "100", receivedAmount: "100", receivedAmountUsd: "200",
  });
});

test("differences below visible token precision remain absent from the comparison", () => {
  for (const receivedAmountRaw of ["100000001", "100000009"]) {
    const receipt = getSwapReceipt({ ...quoted, quotedOutputAmount: "100.000005", receivedAmountRaw });
    assert.equal(receipt.comparison, undefined);
    assert.notEqual(receipt.receivedAmount, receipt.quotedAmount);
  }
});

test("small token amounts retain significant digits and show visible differences", () => {
  const receipt = getSwapReceipt({
    quotedOutputAmount: "0.000000000000000001", quotedOutputAmountUsd: "0.01",
    receivedAmountRaw: "2", outputDecimals: 18,
  });
  assert.equal(receipt.receivedAmount, "0.000000000000000002");
  assert.equal(receipt.receivedAmountUsd, "0.02");
  assert.deepEqual(receipt.comparison, {
    direction: "more", quotedAmount: "0.000000000000000001",
    differenceAmount: "0.000000000000000001", differencePercent: "100",
  });
});

test("large raw values and fractional quote totals retain precision beyond Number", () => {
  const receipt = getSwapReceipt({
    quotedOutputAmount: "123456789012.34567890123456789",
    quotedOutputAmountUsd: "246913578024.69135780246913578",
    receivedAmountRaw: "123456789013345678901234567890", outputDecimals: 18,
  });
  assert.equal(receipt.receivedAmount, "123456789013.34567890123456789");
  assert.equal(receipt.receivedAmountUsd, "246913578026.69135780246913578");
  assert.equal(receipt.comparison?.differenceAmount, "1");
  assert.equal(receipt.comparison?.direction, "more");
});

test("proportional USD preserves fractional cents without display rounding", () => {
  const receipt = getSwapReceipt({
    quotedOutputAmount: "4", quotedOutputAmountUsd: "4.0000000000000000004",
    receivedAmountRaw: "3", outputDecimals: 0,
  });
  assert.equal(receipt.receivedAmountUsd, "3.0000000000000000003");
  assert.equal(receipt.comparison?.differencePercent, "25");
});

test("missing or invalid fills never invent a received amount from the quote", () => {
  for (const receivedAmountRaw of [undefined, "", "NaN", "Infinity", "-1", "1.5", "1e6", " 1", "0x10"]) {
    assert.deepEqual(getSwapReceipt({ ...quoted, receivedAmountRaw }), { quotedAmount: "100" });
  }
  for (const outputDecimals of [-1, 1.5, 256, NaN]) {
    assert.deepEqual(getSwapReceipt({ ...quoted, receivedAmountRaw: "100000000", outputDecimals }), { quotedAmount: "100" });
  }
});

test("a real zero fill stays zero instead of falling back to the quoted estimate", () => {
  assert.deepEqual(getSwapReceipt({ ...quoted, receivedAmountRaw: "0" }), {
    quotedAmount: "100", receivedAmount: "0", receivedAmountUsd: "0",
    comparison: { direction: "less", quotedAmount: "100", differenceAmount: "100", differencePercent: "100" },
  });
});

test("missing or invalid quote USD leaves the actual amount available without inventing a valuation", () => {
  for (const quotedOutputAmountUsd of [undefined, "", "NaN", "Infinity", "-1"]) {
    const receipt = getSwapReceipt({ ...quoted, quotedOutputAmountUsd, receivedAmountRaw: "110000000" });
    assert.equal(receipt.receivedAmount, "110");
    assert.equal(receipt.receivedAmountUsd, undefined);
    assert.equal(receipt.comparison?.direction, "more");
  }
  assert.equal(getSwapReceipt({ ...quoted, quotedOutputAmountUsd: "0", receivedAmountRaw: "110000000" }).receivedAmountUsd, "0");
});

test("an invalid or zero quote cannot supply a ratio or comparison but never hides a valid actual fill", () => {
  for (const quotedOutputAmount of ["", "NaN", "Infinity", "-1", "0", "0.0000001"]) {
    assert.deepEqual(getSwapReceipt({ ...quoted, quotedOutputAmount, receivedAmountRaw: "110000000" }), {
      quotedAmount: quotedOutputAmount, receivedAmount: "110",
    });
  }
});
