/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { test, before } = require("node:test");
const ts = require("typescript");

// Exercise the actual SDK and the app's TypeScript adapter with Node's test runner.
const source = readFileSync(resolve(__dirname, "../components/developer-tools/order-form-calculation.ts"), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;
const adapter = {};
new Function("require", "exports", compiled)(require, adapter);
const { calculateEditedOrderForm, rebuildCalculatedPermit, validateOrderFormInput } = adapter;

const account = "0x5555555555555555555555555555555555555555";
const inputToken = "0x1111111111111111111111111111111111111111";
const outputToken = "0x2222222222222222222222222222222222222222";
const spender = "0x3333333333333333333333333333333333333333";
const defaults = () => ({ formParams: {
  module: "TWAP", inputTokenDecimals: 18, outputTokenDecimals: 6,
  quotedOutputAmountRaw: "1000000000", inputTokenUsdPrice: "1000", outputTokenUsdPrice: "1",
  minTradeSizeUsd: 5, priceProtectionPercent: 3, displayFeePercent: 0,
  userInput: {
    inputAmountUi: "1", isMarketOrder: true, tradeCount: 10,
    tradeInterval: { value: 5, unit: 60000 },
    orderDuration: { value: 12, unit: 3600000 },
    limitPriceUi: "", triggerPriceUi: "", isPriceInverted: false,
  },
} });
const template = () => ({
  domain: { name: "RePermit", version: "1", chainId: 137, verifyingContract: spender },
  primaryType: "PermitWitnessTransferFrom", types: {},
  order: {
    permitted: { token: inputToken, amount: "1" }, nonce: "1700000000123", deadline: "1700000060",
    witness: {
      exchange: { adapter: spender },
      chainid: 137, swapper: account, nonce: "1700000000123", start: "1700000000", deadline: "1700000060",
      input: { token: inputToken, amount: "1", maxAmount: "1" },
      output: { token: outputToken, recipient: account, limit: "0", triggerLower: "0", triggerUpper: "0" },
    },
  },
});

let client;
before(async () => {
  const sdk = require("@orbs-network/spot-ui");
  const originalFetch = global.fetch;
  global.fetch = async () => ({ ok: true, json: async () => template() });
  try { client = await sdk.createClient(sdk.getPartners().find(p => p.chainId === 137).name, 137); }
  finally { global.fetch = originalFetch; }
});

test("edited amount and trade count rebuild the live spending and per-trade amounts", () => {
  const input = defaults();
  input.formParams.userInput.inputAmountUi = "2";
  input.formParams.quotedOutputAmountRaw = "2000000000";
  input.formParams.userInput.tradeCount = 20;
  const form = calculateEditedOrderForm(input);
  const before = template();
  const original = structuredClone(before);
  const result = rebuildCalculatedPermit(before, form, account, client);
  assert.equal(result.order.permitted.amount, "2000000000000000000");
  assert.equal(result.order.witness.input.maxAmount, "2000000000000000000");
  assert.equal(result.order.witness.input.amount, "100000000000000000");
  assert.equal(result.order.witness.output.limit, form.values.minOutputAmountPerTrade);
  assert.equal(result.domain.verifyingContract, spender);
  assert.equal(result.order.permitted.token, inputToken);
  assert.equal(result.order.witness.output.token, outputToken);
  assert.deepEqual(before, original);
});

test("edited duration, interval, protection and account survive timing refresh", (t) => {
  t.mock.method(Date, "now", () => 1800000000000);
  const input = defaults();
  input.formParams.userInput.orderDuration.value = 24;
  input.formParams.userInput.tradeInterval.value = 10;
  input.formParams.priceProtectionPercent = 2;
  const form = calculateEditedOrderForm(input);
  const fresh = template();
  fresh.order.witness.start = "1700000100";
  fresh.order.nonce = fresh.order.witness.nonce = "1700000100456";
  const newAccount = "0x6666666666666666666666666666666666666666";
  const result = rebuildCalculatedPermit(fresh, form, newAccount, client);
  assert.equal(result.order.witness.epoch, 600);
  assert.equal(result.order.witness.slippage, 200);
  assert.equal(result.order.deadline, String(Number(result.order.witness.start) + 24 * 3600 + 60));
  assert.equal(result.order.witness.deadline, result.order.deadline);
  assert.ok(BigInt(result.order.nonce) > BigInt(fresh.order.nonce));
  assert.equal(result.order.witness.nonce, result.order.nonce);
  assert.equal(result.order.witness.swapper, newAccount);
  assert.equal(result.order.witness.output.recipient, newAccount);
});

test("invalid calculation inputs cannot be saved", () => {
  for (const amount of ["0", "-1", "not-a-number"]) {
    const input = defaults();
    input.formParams.userInput.inputAmountUi = amount;
    assert.ok(validateOrderFormInput(input).length > 0);
    assert.throws(() => calculateEditedOrderForm(input));
  }
  const input = defaults();
  input.formParams.inputTokenDecimals = 18.5;
  assert.ok(validateOrderFormInput(input).length > 0);
});

test("trigger order edits populate the correct RePermit bound", () => {
  for (const [module, price, bound] of [["STOP_LOSS", "900", "triggerLower"], ["TAKE_PROFIT", "1100", "triggerUpper"]]) {
    const input = defaults();
    input.formParams.module = module;
    input.formParams.userInput.tradeCount = 1;
    input.formParams.userInput.triggerPriceUi = price;
    const form = calculateEditedOrderForm(input);
    const result = rebuildCalculatedPermit(template(), form, account, client);
    assert.equal(result.order.witness.output[bound], form.values.triggerOutputAmountPerTrade);
    assert.notEqual(result.order.witness.output[bound], "0");
    assert.equal(result.order.witness.epoch, 0);
  }
});
