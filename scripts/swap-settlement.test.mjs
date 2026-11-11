import assert from "node:assert/strict";
import test from "node:test";
import { OrderStatus } from "@orbs-network/spot-ui";
import { OrderSettlementError, waitForOrder, watchOrder } from "../lib/swap/settlement.ts";

const order = (patch = {}) => ({ id: `0x${"1".repeat(64)}`, chainId: 56,
  deadline: Date.now() + 1_000, status: OrderStatus.Open, fills: [], ...patch });

test("settlement uses the captured client serially and retries missing, failed and foreign lookups", async () => {
  const accepted = order();
  let calls = 0;
  let active = 0;
  const client = { chainId: 56, async getOrder({ orderId, signal }) {
    assert.equal(this, client);
    assert.equal(orderId, accepted.id);
    assert.equal(signal.aborted, false);
    assert.equal(++active, 1);
    await Promise.resolve();
    active--;
    calls++;
    if (calls === 1) return undefined;
    if (calls === 2) throw new Error("Index temporarily unavailable");
    if (calls === 3) return order({ id: "another order", status: OrderStatus.Completed });
    if (calls === 4) return order({ status: OrderStatus.Open, progress: 50 });
    return order({ status: OrderStatus.Completed, progress: 100 });
  } };
  const snapshots = [];
  for await (const current of watchOrder({ client, order: accepted, pollIntervalMillis: 1 })) snapshots.push(current);
  assert.equal(calls, 5);
  assert.deepEqual(snapshots.map(item => item.status), [OrderStatus.Open, OrderStatus.Completed]);
});

test("known completion needs no new request and terminal failures retain their final snapshot", async () => {
  const client = { chainId: 56, getOrder: () => assert.fail("Terminal orders need no lookup") };
  const completed = order({ status: OrderStatus.Completed });
  assert.equal(await waitForOrder({ client, order: completed }), completed);
  for (const [status, reason] of [[OrderStatus.Cancelled, "cancelled"], [OrderStatus.Expired, "expired"]]) {
    const snapshots = [];
    await assert.rejects(async () => {
      for await (const current of watchOrder({ client, order: order({ status }) })) snapshots.push(current);
    }, error => error instanceof OrderSettlementError && error.reason === reason);
    assert.equal(snapshots[0].status, status);
  }
});

test("an elapsed tracking bound is unconfirmed and never infers expiration", async () => {
  const accepted = order({ deadline: Date.now() - 61_000 });
  const client = { chainId: 56, getOrder: () => assert.fail("Tracking is already bounded") };
  await assert.rejects(waitForOrder({ client, order: accepted }), error =>
    error instanceof OrderSettlementError && error.reason === "unconfirmed" && error.orderId === accepted.id);
  assert.equal(accepted.status, OrderStatus.Open);
});

test("aborting a pending lookup stops local tracking without classifying the order as failed", async () => {
  const controller = new AbortController();
  let started;
  const ready = new Promise(resolve => { started = resolve; });
  const accepted = order();
  const client = { chainId: 56, getOrder: ({ signal }) => new Promise((resolve, reject) => {
    signal.addEventListener("abort", () => reject(signal.reason), { once: true });
    started();
  }) };
  const result = waitForOrder({ client, order: accepted, signal: controller.signal });
  await ready;
  controller.abort();
  await assert.rejects(result, error => error instanceof OrderSettlementError && error.reason === "aborted");
  assert.equal(accepted.status, OrderStatus.Open);
});

test("a pending status request is aborted at the original signed tracking bound", async () => {
  const accepted = order({ deadline: Date.now() + 15 });
  let requestedSignal;
  const client = { chainId: 56, getOrder: ({ signal }) => new Promise((resolve, reject) => {
    requestedSignal = signal;
    signal.addEventListener("abort", () => reject(signal.reason), { once: true });
  }) };
  // Keep Node alive while its unref'ed AbortSignal timeout is pending.
  const keepAlive = setTimeout(() => {}, 1_000);
  try {
    await assert.rejects(waitForOrder({ client, order: accepted, indexingGraceMillis: 0 }), error =>
      error instanceof OrderSettlementError && error.reason === "unconfirmed");
    assert.equal(requestedSignal.aborted, true);
  } finally { clearTimeout(keepAlive); }
});

test("tracking rejects a client from another chain before requesting status", async () => {
  const client = { chainId: 137, getOrder: () => assert.fail("Wrong network") };
  await assert.rejects(waitForOrder({ client, order: order() }), /submitting client/);
});
