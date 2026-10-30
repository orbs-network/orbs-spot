import assert from "node:assert/strict";
import test from "node:test";
import { displayTokenAmount, formatAmount, formatBalanceAmount, formatDisplayAmount } from "../lib/token-display.ts";

test("ordinary amounts use at most four decimal places without rounding up", () => {
  for (const [raw, expected] of [
    ["1.23456789", "1.2345"], ["1234567.891234", "1234567.8912"],
    ["0.123456789", "0.1234"], ["0.0123456789", "0.0123"],
    ["1.00009", "1"], ["1.2300", "1.23"], ["-1.23456789", "-1.2345"],
    ["0", "0"], ["-0", "0"],
  ]) assert.equal(formatAmount(raw), expected);
});

test("tiny amounts retain their leading zeros and three significant digits", () => {
  for (const [raw, expected] of [
    ["0.00123456789", "0.00123"], ["0.000123456789", "0.000123"],
    ["0.0000234243234", "0.0000234"], ["0.000000234243234", "0.000000234"],
    ["0.000000000000000001", "0.000000000000000001"],
    ["0.000020009", "0.00002"], ["-0.0000234243234", "-0.0000234"],
    ["2.34243234e-30", `0.${"0".repeat(29)}234`],
  ]) assert.equal(formatAmount(raw), expected);
});

test("read-only labels use the same precision, preserve tiny token amounts and group thousands", () => {
  assert.equal(formatDisplayAmount("1234567.891234"), "1,234,567.8912");
  assert.equal(formatDisplayAmount("0.0000234243234"), "0.0000234");
  assert.equal(formatDisplayAmount("0.000000234243234"), "0.000000234");
  assert.equal(formatDisplayAmount("-0.0000234243234", { suffix: "%" }), "-0.0000234%");
  assert.equal(displayTokenAmount("0.0000234243234", "TEST", 18), "0.0000234");
});

test("explicit lower precision and token decimal limits remain respected", () => {
  assert.equal(formatAmount("1.23456789", 2), "1.23");
  assert.equal(formatAmount("0.123456789", 2), "0.12");
  assert.equal(formatAmount("1.23456789", 18), "1.2345");
  assert.equal(formatAmount("1.23456789", 4, 2), "1.23");
  assert.equal(formatAmount("12.3456789", 4, 0), "12");
  assert.equal(formatDisplayAmount("12.3456789", { decimalScale: 2, prefix: "$" }), "$12.34");
  assert.equal(formatDisplayAmount("0.0000234243234", { decimalScale: 2, prefix: "$" }), "<$0.01");
  assert.equal(formatDisplayAmount("0.000000234", { minimum: "0.00001" }), "<0.00001");
  assert.equal(formatBalanceAmount("0.0000000776"), "<0.00001");
  assert.equal(formatBalanceAmount("0"), "0");
  assert.equal(formatBalanceAmount("0.00001"), "0.00001");
  assert.equal(formatBalanceAmount("1.23456789"), "1.2345");
});

test("formatting is display-only and invalid values never render as numbers", () => {
  const raw = "12345678901234567890.123456789012345678";
  assert.equal(formatAmount(raw), "12345678901234567890.1234");
  assert.equal(raw, "12345678901234567890.123456789012345678");
  for (const value of [undefined, "", "NaN", "Infinity", "not a number"]) {
    assert.equal(formatAmount(value), "");
    assert.equal(formatDisplayAmount(value), "");
  }
});
