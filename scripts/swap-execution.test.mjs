import assert from "node:assert/strict";
import test from "node:test";
import { createSwapExecutor } from "../lib/swap/execution.ts";

function fixture({ native, approved }) {
  const plans = [];
  const steps = [];
  const actions = [];
  const intent = { account: "0x1111", chainId: 56, inputToken: "0x2222", outputToken: "0x3333", amount: "10", native };
  const quote = { user: intent.account, inToken: intent.inputToken, outToken: intent.outputToken,
    inAmount: "10", outAmount: "20", minAmountOut: "19", timestamp: Date.now(), eip712: { domain: { chainId: 56 } } };
  const input = {
    intent, quote,
    assertWallet: async () => {},
    hasAllowance: async () => approved,
    wrap: async amount => { actions.push(["wrap", amount]); },
    approve: async () => { actions.push(["approve"]); },
    refreshQuote: async () => quote,
    sign: async () => { actions.push(["sign"]); return "0xsigned"; },
    submit: async () => "0x" + "4".repeat(64),
    confirm: async () => ({ status: "success" }),
    onPlan: plan => plans.push(plan),
    onStep: (step, index) => steps.push([step, index]),
    onWrapped: () => {}, onApproved: () => {}, onSubmitted: () => {},
  };
  return { input, plans, steps, actions };
}

test("swap progress exposes the complete wrap, approve and sign plan", async () => {
  const { input, plans, steps, actions } = fixture({ native: true, approved: false });
  await createSwapExecutor().execute(input);
  assert.deepEqual(plans, [["WRAP", "APPROVE", "SWAP"]]);
  assert.deepEqual(steps, [["WRAP", 0], ["APPROVE", 1], ["SWAP", 2]]);
  assert.deepEqual(actions, [["wrap", "10"], ["approve"], ["sign"]]);
});

test("an approved ERC-20 swap exposes one signing step", async () => {
  const { input, plans, steps, actions } = fixture({ native: false, approved: true });
  await createSwapExecutor().execute(input);
  assert.deepEqual(plans, [["SWAP"]]);
  assert.deepEqual(steps, [["SWAP", 0]]);
  assert.deepEqual(actions, [["sign"]]);
});
