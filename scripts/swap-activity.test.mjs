import assert from "node:assert/strict";
import test from "node:test";
import { getFillTransactionHash, useSwapActivity, validSwapActivity } from "../lib/swap/activity.ts";

const account = `0x${"1".repeat(40)}`;
const intentId = `0x${"2".repeat(64)}`;
const fillHash = `0x${"3".repeat(64)}`;
const details = { account, chainId: 56, inputSymbol: "BNB", outputSymbol: "USDT", inputAmount: "1", createdAt: Date.now() };
const order = { id: intentId, historyKey: `v2:56:${intentId}`, chainId: 56, deadline: Date.now() + 900_000, status: "OPEN", fills: [] };
const spot = { ...details, kind: "spot", orderId: intentId, order, status: "pending" };
const legacy = { ...details, hash: fillHash, status: "pending" };

test("activity hydration preserves old transactions and accepts bounded Spot intent snapshots", () => {
  assert.equal(validSwapActivity(legacy), true);
  assert.equal(validSwapActivity(spot), true);
  assert.equal(validSwapActivity({ ...spot, order: { ...order, deadline: NaN } }), false);
  assert.equal(validSwapActivity({ ...spot, orderId: fillHash }), false);
  assert.equal(validSwapActivity({ ...spot, order: { ...order, chainId: 1 } }), false);
  const merge = useSwapActivity.persist.getOptions().merge;
  const hydrated = merge({ items: [legacy, spot, { ...spot, order: {} }] }, useSwapActivity.getState());
  assert.deepEqual(hydrated.items, [legacy, spot]);
});

test("a submitted intent does not gain a transaction hash or completed state before a fill", () => {
  useSwapActivity.setState({ items: [] });
  useSwapActivity.getState().add(spot);
  assert.equal(getFillTransactionHash(order), undefined);
  useSwapActivity.getState().settle(56, intentId, "confirmed", order);
  assert.equal(useSwapActivity.getState().items[0].status, "pending");
  assert.equal(useSwapActivity.getState().items[0].txHash, undefined);
  assert.equal(validSwapActivity({ ...spot, status: "confirmed" }), false);
  const filled = { ...order, status: "COMPLETED", fills: [{ txHash: fillHash }] };
  useSwapActivity.getState().settle(56, intentId, "confirmed", filled);
  assert.equal(useSwapActivity.getState().items[0].status, "confirmed");
  assert.equal(useSwapActivity.getState().items[0].txHash, fillHash);
  assert.equal(validSwapActivity(useSwapActivity.getState().items[0]), true);
});

test("uncertain and terminal order outcomes retain the intent independently of old transactions", () => {
  useSwapActivity.setState({ items: [] });
  useSwapActivity.getState().add(legacy);
  useSwapActivity.getState().add(spot);
  useSwapActivity.getState().settle(56, intentId, "unconfirmed");
  assert.equal(useSwapActivity.getState().items[0].status, "unconfirmed");
  assert.equal(useSwapActivity.getState().items[1].status, "pending");
  assert.equal(useSwapActivity.getState().items[0].orderId, intentId);
  useSwapActivity.getState().settle(56, intentId, "expired");
  assert.equal(useSwapActivity.getState().items[0].status, "expired");
  useSwapActivity.getState().settle(56, fillHash, "reverted");
  assert.equal(useSwapActivity.getState().items[1].status, "reverted");
});
