import assert from "node:assert/strict";
import test from "node:test";
import { OrderStatus } from "@orbs-network/spot-ui";
import { OrderSettlementError } from "../lib/swap/settlement.ts";
import { getFillTransactionHash, resolveSwapSettlementOrder, useSwapActivity, validSwapActivity } from "../lib/swap/activity.ts";

const account = `0x${"1".repeat(40)}`;
const intentId = `0x${"2".repeat(64)}`;
const fillHash = `0x${"3".repeat(64)}`;
const details = { account, chainId: 56, inputSymbol: "BNB", outputSymbol: "USDT", inputAmount: "1", createdAt: Date.now() };
const order = { id: intentId, historyKey: `v2:56:${intentId}`, chainId: 56, deadline: Date.now() + 900_000, status: "OPEN", fills: [] };
const spot = { ...details, kind: "spot", orderId: intentId, order, status: "pending" };
const legacy = { ...details, hash: fillHash, status: "pending" };

test("typed expiry and cancellation replace a matching stale open snapshot without losing fill data", () => {
  for (const [reason, expected] of [["expired", OrderStatus.Expired], ["cancelled", OrderStatus.Cancelled]]) {
    const open = { ...order, fills: [{ txHash: fillHash }], dstAmountFilled: "12" };
    const resolved = resolveSwapSettlementOrder(open, new OrderSettlementError("Terminal settlement", reason, intentId));
    assert.equal(resolved.status, expected);
    assert.equal(resolved.fills, open.fills);
    assert.equal(resolved.dstAmountFilled, "12");
    assert.equal(open.status, OrderStatus.Open);
    useSwapActivity.setState({ items: [] });
    useSwapActivity.getState().add({ ...spot, order: open });
    useSwapActivity.getState().settle(56, intentId, reason, resolved);
    assert.equal(useSwapActivity.getState().items[0].status, reason);
    assert.equal(useSwapActivity.getState().items[0].order.status, expected);
  }
});

test("unconfirmed tracking, foreign errors and elapsed deadlines cannot falsely expire a swap", () => {
  const pastDeadline = { ...order, deadline: 1 };
  for (const error of [
    new OrderSettlementError("Unconfirmed", "unconfirmed", intentId),
    new OrderSettlementError("Stopped", "aborted", intentId),
    new OrderSettlementError("Other order expired", "expired", fillHash),
    new Error("Request failed"),
  ]) assert.equal(resolveSwapSettlementOrder(pastDeadline, error), pastDeadline);
  assert.equal(resolveSwapSettlementOrder(undefined, new OrderSettlementError("Expired", "expired", intentId)), undefined);
});

test("known terminal snapshots take precedence over a late expiry error", () => {
  for (const status of [OrderStatus.Completed, OrderStatus.Cancelled, OrderStatus.Expired]) {
    const terminal = { ...order, status };
    assert.equal(resolveSwapSettlementOrder(terminal, new OrderSettlementError("Expired", "expired", intentId)), terminal);
  }
});

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

test("activity retains token logos and output amount for recovered toasts while accepting older entries", () => {
  const inputToken = { address: account, symbol: "BNB", decimals: 18, logoUrl: "/bnb.svg" };
  const outputToken = { address: account, symbol: "USDT", decimals: 6, logoUrl: "/usdt.svg" };
  const rich = { ...spot, inputToken, outputToken, outputAmount: "123.456789", partner: "external" };
  assert.equal(validSwapActivity(rich), true);
  const merge = useSwapActivity.persist.getOptions().merge;
  const hydrated = merge({ items: [legacy, spot, rich] }, useSwapActivity.getState());
  assert.deepEqual(hydrated.items, [legacy, spot, rich]);
  assert.equal(validSwapActivity({ ...rich, outputToken: { ...outputToken, decimals: "6" } }), false);
  assert.equal(validSwapActivity({ ...rich, inputToken: { ...inputToken, symbol: {} } }), false);
  assert.equal(validSwapActivity({ ...rich, partner: "unknown" }), false);
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
