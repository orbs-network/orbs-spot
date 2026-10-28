import assert from "node:assert/strict";
import test from "node:test";
import { createOrderSubmissionManager } from "../lib/spot/order-submissions.ts";
import { createOrderExecutor, ExecutionPhase } from "../lib/spot/execution.ts";

const tick = () => new Promise(resolve => setImmediate(resolve));

test("closing review resets its state while the captured submission continues", async () => {
  const visible = [];
  const manager = createOrderSubmissionManager(snapshot => visible.push(snapshot));
  const session = manager.start();
  let resolveOrder;
  const accepted = new Promise(resolve => { resolveOrder = resolve; });
  const originalOrder = { historyKey: "original" };
  const executor = createOrderExecutor(session.publish);
  const pending = executor.submit({
    account: "0x2222222222222222222222222222222222222222",
    form: { canSubmit: true, values: { inputAmount: "10" } },
    inputToken: { address: "0x1111111111111111111111111111111111111111" },
    outputToken: { address: "0x3333333333333333333333333333333333333333" },
    client: {
      chainId: 1,
      spenderAddress: "0x4444444444444444444444444444444444444444",
      prepareOrder: () => ({ signingRequest: {}, order: { amount: "10" } }),
      submitOrder: () => accepted,
    },
    wallet: {
      assertContext: async () => {},
      getAllowance: async () => "10",
      signOrder: async () => "0xsignature",
    },
  }).finally(session.complete);
  await tick();
  assert.equal(visible.at(-1).phase, ExecutionPhase.SUBMITTING);
  manager.detach();
  assert.equal(visible.at(-1), undefined);
  assert.equal(manager.isBusy(), false);

  const next = manager.start();
  const nextSnapshot = { phase: ExecutionPhase.SIGNING, form: { values: { inputAmount: "25" } } };
  next.publish(nextSnapshot);
  assert.equal(manager.isBusy(), true);
  resolveOrder(originalOrder);
  assert.equal(await pending, originalOrder);
  assert.equal(visible.at(-1), nextSnapshot);
  assert.equal(manager.isBusy(), true);
  assert.equal(next.isCurrent(), true);
  assert.equal(session.isCurrent(), false);
});

test("an old background failure cannot replace a new review", () => {
  const visible = [];
  const manager = createOrderSubmissionManager(snapshot => visible.push(snapshot));
  const old = manager.start();
  assert.equal(manager.reset(), false);
  manager.detach();
  const next = manager.start();
  next.publish({ phase: ExecutionPhase.PREPARING });
  const count = visible.length;
  old.publish({ phase: ExecutionPhase.FAILED, error: { message: "Old HTTP request failed" } });
  old.complete();
  assert.equal(visible.length, count);
  assert.equal(manager.isBusy(), true);
  next.complete();
  assert.equal(manager.reset(), true);
  assert.equal(visible.at(-1), undefined);
});
