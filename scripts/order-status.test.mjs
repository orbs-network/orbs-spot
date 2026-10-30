import assert from "node:assert/strict";
import test from "node:test";
import { getOrders, OrderStatus } from "@orbs-network/spot-ui";
import { normalizeOrderStatus } from "../lib/spot/order-status.ts";

const token = "0x1111111111111111111111111111111111111111";
function rawOrder(status, description, filled = 2, deadline = "2000000000") {
  return {
    hash: "0x" + "2".repeat(64), signature: "0x", timestamp: "2026-10-18T09:00:00Z",
    metadata: { status, description, expectedChunks: 5, repermitDigest: "0x" + "3".repeat(64),
      chunks: Array.from({ length: filled }, (_, index) => ({ status: "success", inAmount: "10", outAmount: "20", timestamp: `2026-10-18T09:0${index}:00Z`, txHash: "0x" + String(index + 1).repeat(64) })) },
    order: { permitted: { token, amount: "50" }, spender: token, nonce: "1", deadline,
      witness: { chainid: 56, swapper: token, epoch: 60,
        input: { token, amount: "10", maxAmount: "50" },
        output: { token, limit: "1", recipient: token } } },
  };
}

async function fromSdk(t, raw) {
  t.mock.method(globalThis, "fetch", async () => Response.json({ orders: [raw] }));
  const [order] = await getOrders({ swapper: token, getv1orders: false });
  assert.ok(order);
  return order;
}

test("partial cancellation metadata corrects the SDK status without losing fills", async t => {
  const order = await fromSdk(t, rawOrder("partially_completed", "Cancelled, Some chunks successful, some errored"));
  assert.equal(order.status, OrderStatus.Open);
  const corrected = normalizeOrderStatus(order);
  assert.equal(corrected.status, OrderStatus.Cancelled);
  assert.equal(corrected.fills, order.fills);
  assert.equal(corrected.srcAmountFilled, "20");
  assert.equal(corrected.dstAmountFilled, "40");
  assert.equal(corrected.progress, 40);
  assert.equal(order.status, OrderStatus.Open);
});

test("US spelling and whitespace in cancellation descriptions are supported", async t => {
  const order = await fromSdk(t, rawOrder("partially_completed", "  CANCELED, Some chunks successful, some errored"));
  assert.equal(normalizeOrderStatus(order).status, OrderStatus.Cancelled);
});

test("partial fills remain open before their signed deadline", async t => {
  for (const description of ["Some chunks successful, some errored", "expired - all chunks errored", "Cancellation failed", ""]) {
    const order = await fromSdk(t, rawOrder("partially_completed", description));
    assert.equal(normalizeOrderStatus(order), order);
    assert.equal(order.status, OrderStatus.Open);
  }
});

test("failed and partial orders expire after their deadline without losing fills", async t => {
  for (const status of ["expired", "failed", "partially_completed"]) {
    const order = await fromSdk(t, rawOrder(status, "Some chunks successful, some errored", 2, "1"));
    const normalized = normalizeOrderStatus(order);
    assert.equal(normalized, order);
    assert.equal(normalized.status, OrderStatus.Expired);
    assert.equal(normalized.fills.length, 2);
    assert.equal(normalized.srcAmountFilled, "20");
    assert.equal(normalized.dstAmountFilled, "40");
    assert.equal(normalized.progress, 40);
  }
});

test("partial cancellation descriptions take precedence after the deadline", async t => {
  const order = await fromSdk(t, rawOrder("partially_completed", "Cancelled, Some chunks successful, some errored", 2, "1"));
  assert.equal(order.status, OrderStatus.Expired);
  const corrected = normalizeOrderStatus(order);
  assert.equal(corrected.status, OrderStatus.Cancelled);
  assert.equal(corrected.fills, order.fills);
  assert.equal(corrected.srcAmountFilled, "20");
  assert.equal(corrected.dstAmountFilled, "40");
});

test("unknown service statuses remain open after the deadline", async t => {
  for (const status of ["pending", "unexpected_status"]) {
    const order = await fromSdk(t, rawOrder(status, "", 2, "1"));
    assert.equal(normalizeOrderStatus(order), order);
    assert.equal(order.status, OrderStatus.Open);
  }
});

test("completed orders and already recognized cancellations are unchanged", async t => {
  for (const [status, description, filled, expected] of [
    ["completed", "Cancelled, Some chunks successful, some errored", 5, OrderStatus.Completed],
    ["failed", "Cancelled by contract", 0, OrderStatus.Cancelled],
    ["pending", "", 2, OrderStatus.Open],
    ["pending", "Cancelled, Some chunks successful, some errored", 2, OrderStatus.Open],
  ]) {
    const order = await fromSdk(t, rawOrder(status, description, filled));
    assert.equal(order.status, expected);
    assert.equal(normalizeOrderStatus(order), order);
  }
});
