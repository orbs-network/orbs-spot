import assert from "node:assert/strict";
import test from "node:test";
import { OrderStatus, Partners } from "@orbs-network/spot-ui";
import { useSubmissionPreview } from "../lib/submission-preview.ts";

const account = `0x${"1".repeat(40)}`;
const order = { id: "order-a", historyKey: "v2:56:order-a", chainId: 56, maker: account,
  status: OrderStatus.Open, fills: [], rawOrder: { input: "10" } };
const preview = (id = "first") => ({ id, kind: "swap", title: "Swap in progress", status: "pending",
  chainId: 56, account, partner: Partners.External,
  input: { token: { symbol: "BNB", logoUrl: "/bnb.svg", decimals: 18 }, amount: "1.123456789012345678" },
  output: { token: { symbol: "USDC", decimals: 6 }, amount: "1234.567891" },
  swapQuote: { outputAmount: "1234.567891", outputAmountUsd: "1234.56" },
  details: [{ label: "Minimum received", value: "1200 USDC" }],
  transactions: [{ label: "Wrap transaction", hash: "0xabc" }],
});
const reset = () => useSubmissionPreview.setState({ entries: {}, selectedId: undefined });

test("preview captures trade labels, order, and transaction data independently of mutable caller objects", () => {
  reset();
  const input = { ...preview(), order: structuredClone(order) };
  useSubmissionPreview.getState().upsert(input);
  input.input.token.symbol = "EDITED";
  input.input.amount = "99";
  input.swapQuote.outputAmount = "9999";
  input.swapQuote.outputAmountUsd = "9999";
  input.details[0].value = "0";
  input.transactions[0].hash = "changed";
  input.order.status = OrderStatus.Completed;
  const captured = useSubmissionPreview.getState().entries.first;
  assert.equal(captured.input.token.symbol, "BNB");
  assert.equal(captured.input.amount, "1.123456789012345678");
  assert.deepEqual(captured.swapQuote, { outputAmount: "1234.567891", outputAmountUsd: "1234.56" });
  assert.equal(captured.details[0].value, "1200 USDC");
  assert.equal(captured.transactions[0].hash, "0xabc");
  assert.equal(captured.order.status, OrderStatus.Open);
});

test("opening an older submission and closing its preview never selects or replaces a newer submission", () => {
  reset();
  const store = useSubmissionPreview.getState();
  store.upsert(preview());
  store.upsert({ ...preview("second"), input: { token: { symbol: "ETH" }, amount: "2" } });
  store.open("first");
  store.upsert({ ...preview("second"), title: "Approval confirmed" });
  assert.equal(useSubmissionPreview.getState().selectedId, "first");
  assert.equal(useSubmissionPreview.getState().entries.first.input.token.symbol, "BNB");
  store.close();
  assert.equal(useSubmissionPreview.getState().selectedId, undefined);
  assert.equal(useSubmissionPreview.getState().entries.second.title, "Approval confirmed");
});

test("order updates require the captured identity and terminal orders cannot reopen from stale polling", () => {
  reset();
  const store = useSubmissionPreview.getState();
  store.upsert({ ...preview(), order });
  store.updateOrder("first", { ...order, historyKey: "other", status: OrderStatus.Completed });
  store.updateOrder("first", { ...order, chainId: 1, status: OrderStatus.Completed });
  store.updateOrder("first", { ...order, maker: "other", status: OrderStatus.Completed });
  assert.equal(useSubmissionPreview.getState().entries.first.order.status, OrderStatus.Open);
  store.updateOrder("first", { ...order, status: OrderStatus.Cancelled });
  store.updateOrder("first", order);
  store.upsert({ ...preview(), order });
  assert.equal(useSubmissionPreview.getState().entries.first.order.status, OrderStatus.Cancelled);
  const before = useSubmissionPreview.getState().entries.first;
  store.updateOrder("first", { ...order, status: OrderStatus.Cancelled });
  assert.equal(useSubmissionPreview.getState().entries.first, before);
});

test("settlement updates retain a confirmed cancellation hash without duplicating transaction links", () => {
  reset();
  const store = useSubmissionPreview.getState();
  store.upsert(preview());
  store.upsert({ ...preview(), transactions: [{ label: "Cancellation transaction", hash: "0xDEF" }] });
  store.upsert({ ...preview(), status: "error", transactions: [{ label: "Swap transaction", hash: "0xABC" }] });
  assert.deepEqual(useSubmissionPreview.getState().entries.first.transactions, [
    { label: "Swap transaction", hash: "0xABC" }, { label: "Cancellation transaction", hash: "0xDEF" },
  ]);
});

test("old outcomes are bounded while selected previews and accepted open orders stay available", () => {
  reset();
  const store = useSubmissionPreview.getState();
  store.upsert({ ...preview("selected"), status: "error" });
  store.open("selected");
  store.upsert({ ...preview("accepted"), status: "success", order });
  for (let index = 0; index < 40; index++) store.upsert({ ...preview(`finished-${index}`), status: "success" });
  const { entries } = useSubmissionPreview.getState();
  assert.ok(entries.selected);
  assert.ok(entries.accepted);
  assert.equal(entries["finished-0"], undefined);
  assert.equal(Object.keys(entries).length, 32);
});
