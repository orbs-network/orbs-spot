import assert from "node:assert/strict";
import test from "node:test";
import { createOrderExecutor, ExecutionPhase, Steps } from "../lib/spot/execution.ts";

function fixture() {
  const snapshots = [];
  const executor = createOrderExecutor(snapshot => snapshots.push(snapshot));
  const deadlineMillis = 1_800_000_123_000;
  const form = { canSubmit: true, values: { inputAmount: "10" } };
  const inputToken = { address: "0x1111111111111111111111111111111111111111" };
  let finishSigning;
  const signing = new Promise(resolve => { finishSigning = resolve; });
  const order = { deadline: deadlineMillis };
  const preparedOrder = { deadline: String(deadlineMillis / 1000) };
  const input = {
    account: "0x2222222222222222222222222222222222222222",
    form, inputToken, outputToken: inputToken,
    client: {
      chainId: 1, spenderAddress: inputToken.address,
      prepareOrder: () => ({ values: { deadlineMillis: deadlineMillis + 999 }, signingRequest: {}, order: preparedOrder }),
      submitOrder: async submitted => { assert.equal(submitted, preparedOrder); return order; },
    },
    wallet: {
      assertContext: async () => {},
      getAllowance: async () => "10",
      signOrder: () => signing,
    },
  };
  return { snapshots, executor, input, order, finishSigning };
}

test("submission retains the reviewed form and prepared order through success", async () => {
  const { executor, input, snapshots, order, finishSigning } = fixture();
  const pending = executor.submit(input);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(snapshots.at(-1).phase, ExecutionPhase.SIGNING);
  assert.deepEqual(snapshots.at(-1).steps, [Steps.CREATE]);
  input.form.values.inputAmount = "99";
  assert.equal(snapshots.at(-1).form.values.inputAmount, "10");
  await assert.rejects(executor.submit(input), /already being submitted/);
  finishSigning("0xfixture");
  assert.equal(await pending, order);
  assert.equal(snapshots.at(-1).phase, ExecutionPhase.SUCCESS);
  assert.deepEqual(snapshots.at(-1).steps, [Steps.CREATE]);
  assert.equal(snapshots.at(-1).form.values.inputAmount, "10");
});

test("submission failure retains the reviewed details until returning to review", async () => {
  const { executor, input, snapshots, finishSigning } = fixture();
  input.client.submitOrder = async () => { throw new Error("Connection lost"); };
  const pending = executor.submit(input);
  await new Promise(resolve => setImmediate(resolve));
  finishSigning("0xfixture");
  await assert.rejects(pending, /Connection lost/);
  assert.equal(snapshots.at(-1).phase, ExecutionPhase.FAILED);
  assert.equal(snapshots.at(-1).failedPhase, ExecutionPhase.SUBMITTING);
  assert.deepEqual(snapshots.at(-1).steps, [Steps.CREATE]);
  assert.equal(snapshots.at(-1).form.values.inputAmount, "10");
  assert.match(snapshots.at(-1).error.message, /Check order history before retrying/);
  assert.equal(executor.reset(), true);
  assert.deepEqual(snapshots.at(-1), { phase: ExecutionPhase.IDLE });
});

test("a rejected server response after signing remains an uncertain submission", async () => {
  const { executor, input, snapshots, finishSigning } = fixture();
  input.client.submitOrder = async () => { throw Object.assign(new Error("Request rejected"), { code: 4001 }); };
  const pending = executor.submit(input);
  const rejected = assert.rejects(pending, /Request rejected/);
  await new Promise(resolve => setImmediate(resolve));
  finishSigning("0xfixture");
  await rejected;
  assert.equal(snapshots.at(-1).phase, ExecutionPhase.FAILED);
  assert.match(snapshots.at(-1).error.message, /Check order history before retrying/);
});

test("native input exposes wrapping and approval only when they are required", async () => {
  const { executor, input, snapshots, finishSigning } = fixture();
  input.wrappedNativeToken = input.inputToken;
  input.inputToken = { address: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" };
  let approved = false;
  const actions = [];
  input.wallet.getAllowance = async () => approved ? "10" : "0";
  input.wallet.wrapNativeToken = async amount => { actions.push(["wrap", amount]); return "0xwrap"; };
  input.wallet.approveToken = async request => { actions.push(["approve", request.amount]); approved = true; return "0xapprove"; };
  const pending = executor.submit(input);
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(snapshots.at(-1).steps, [Steps.WRAP, Steps.APPROVE, Steps.CREATE]);
  assert.equal(snapshots.at(-1).totalSteps, 3);
  assert.equal(snapshots.at(-1).currentStepIndex, 2);
  assert.deepEqual(actions, [["wrap", "10"], ["approve", "10"]]);
  assert.equal(snapshots.at(-1).inputToken.address, input.inputToken.address);
  finishSigning("0xfixture");
  await pending;
});

function nativeRetryFixture() {
  const context = fixture();
  context.input.wrappedNativeToken = context.input.inputToken;
  context.input.inputToken = { address: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" };
  context.actions = [];
  context.input.wallet.wrapNativeToken = async amount => {
    context.actions.push(["wrap", amount]);
    return "0xwrap";
  };
  context.input.wallet.signOrder = async () => { throw new Error("Signing interrupted"); };
  return context;
}

test("retrying with native input always requires a new wrap", async () => {
  const { executor, input, actions, snapshots } = nativeRetryFixture();
  await assert.rejects(executor.submit(input), /Signing interrupted/);
  executor.reset();
  await assert.rejects(executor.submit(input), /Signing interrupted/);
  assert.deepEqual(actions, [["wrap", "10"], ["wrap", "10"]]);
  assert.deepEqual(snapshots.at(-1).steps, [Steps.WRAP, Steps.CREATE]);
});

test("retrying with the wrapped input uses the confirmed funds without wrapping again", async () => {
  const { executor, input, actions, snapshots } = nativeRetryFixture();
  await assert.rejects(executor.submit(input), /Signing interrupted/);
  executor.reset();
  input.inputToken = input.wrappedNativeToken;
  await assert.rejects(executor.submit(input), /Signing interrupted/);
  assert.deepEqual(actions, [["wrap", "10"]]);
  assert.deepEqual(snapshots.at(-1).steps, [Steps.CREATE]);
  assert.equal(snapshots.at(-1).inputToken, input.wrappedNativeToken);
});

test("a late wrap confirmation cannot waive wrapping for another native-input order", async () => {
  const { executor, input, actions } = nativeRetryFixture();
  let confirmWrap;
  input.wallet.wrapNativeToken = amount => {
    actions.push(["wrap", amount]);
    return new Promise(resolve => { confirmWrap = resolve; });
  };
  const pending = executor.submit(input);
  const rejected = assert.rejects(pending, /Signing interrupted/);
  await new Promise(resolve => setImmediate(resolve));
  confirmWrap("0xwrap");
  await rejected;
  executor.reset();
  input.wallet.wrapNativeToken = async amount => {
    actions.push(["wrap", amount]);
    return "0xnewwrap";
  };
  await assert.rejects(executor.submit(input), /Signing interrupted/);
  assert.deepEqual(actions, [["wrap", "10"], ["wrap", "10"]]);
});

test("a wrap is confirmed only after its receipt and remains visible after signature rejection", async () => {
  const { executor, input, snapshots } = fixture();
  input.wrappedNativeToken = input.inputToken;
  input.inputToken = { address: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" };
  let confirmWrap;
  input.wallet.wrapNativeToken = (_amount, onSubmitted) => {
    onSubmitted("0xwrap");
    return new Promise(resolve => { confirmWrap = resolve; });
  };
  input.wallet.signOrder = async () => { throw Object.assign(new Error("User rejected the request"), { code: 4001 }); };
  const pending = executor.submit(input);
  const rejected = assert.rejects(pending, /User rejected/);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(snapshots.at(-1).phase, ExecutionPhase.WRAPPING);
  assert.equal(snapshots.at(-1).wrapTxHash, "0xwrap");
  assert.equal(snapshots.at(-1).currentStepIndex, 0);
  confirmWrap("0xwrap");
  await rejected;
  const confirmed = snapshots.find(snapshot => snapshot.phase === ExecutionPhase.WRAPPING && snapshot.currentStepIndex === 1);
  assert.equal(confirmed.wrapTxHash, "0xwrap");
  assert.equal(snapshots.at(-1).phase, ExecutionPhase.REJECTED);
  assert.equal(snapshots.at(-1).wrapTxHash, "0xwrap");
  assert.equal(snapshots.at(-1).currentStepIndex, 1);
});
