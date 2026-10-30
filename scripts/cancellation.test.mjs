import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";
import { OrderStatus } from "@orbs-network/spot-ui";
import { acquireSubmissionLock, isSubmissionBusy } from "../lib/spot/submission-lock.js";

// Resolve the app's extensionless TS dependency while running source in Node.
registerHooks({ resolve(specifier, context, nextResolve) {
  return nextResolve(specifier === "./mock-orders" && context.parentURL?.endsWith("/lib/spot/cancellation.ts")
    ? "./mock-orders.ts" : specifier, context);
} });
const { cancelOrder, cancelOrderBatch } = await import("../lib/spot/cancellation.ts");

const account = "0x1111111111111111111111111111111111111111";
const contractAddress = "0x2222222222222222222222222222222222222222";
const hash = `0x${"3".repeat(64)}`;
const tick = () => new Promise(resolve => setImmediate(resolve));

function fixture() {
  const writes = [];
  const order = { chainId: 56, maker: account, status: OrderStatus.Open, historyKey: "2:56:original", version: 2 };
  const client = { chainId: 56, partner: "external", getCancelOrderRequest(order) {
    return { order, contractAddress, abi: [], args: order.version === 2 ? [[order.historyKey]] : [order.historyKey] };
  } };
  const wallet = {
    async assertContext(accountToCheck, chainId) { assert.equal(accountToCheck, account); assert.equal(chainId, 56); },
    async cancelOrder(request) { writes.push(request); return hash; },
  };
  return { client, wallet, order, writes };
}

test("a confirmed cancellation preserves the SDK wallet request and releases its wallet lock", async () => {
  const { client, wallet, order, writes } = fixture();
  const request = client.getCancelOrderRequest(order);
  client.getCancelOrderRequest = () => request;
  wallet.cancelOrder = async actual => {
    assert.equal(isSubmissionBusy(), true);
    writes.push(actual);
    return hash;
  };
  assert.equal(await cancelOrder(client, wallet, order, account), hash);
  assert.equal(writes[0], request);
  assert.equal(isSubmissionBusy(), false);
});

test("an open wallet cancellation blocks repeated order cancellation and other wallet prompts until receipt", async () => {
  const { client, wallet, order } = fixture();
  let confirm;
  wallet.cancelOrder = () => new Promise(resolve => { confirm = resolve; });
  const pending = cancelOrder(client, wallet, order, account);
  await tick();
  assert.equal(isSubmissionBusy(), true);
  await assert.rejects(cancelOrder(client, wallet, order, account), /already pending/);
  await assert.rejects(cancelOrderBatch(client, wallet, [order], account), /already pending/);
  await assert.rejects(cancelOrder(client, wallet, { ...order, historyKey: "different" }, account), /pending wallet request/);
  assert.throws(() => acquireSubmissionLock(), /pending wallet request/);
  confirm(hash);
  assert.equal(await pending, hash);
  assert.equal(isSubmissionBusy(), false);
});

test("a failed wallet-lock acquisition clears cancellation keys for a later retry", async () => {
  for (const cancel of [cancelOrder, (client, wallet, order, account) => cancelOrderBatch(client, wallet, [order], account)]) {
    const { client, wallet, order, writes } = fixture();
    const releaseCreation = acquireSubmissionLock();
    await assert.rejects(cancel(client, wallet, order, account), /pending wallet request/);
    assert.equal(writes.length, 0);
    releaseCreation();
    assert.equal(await cancel(client, wallet, order, account), hash);
    assert.equal(isSubmissionBusy(), false);
  }
});

test("non-open, mismatched, and sample orders never reach a wallet write", async () => {
  for (const patch of [
    { status: OrderStatus.Completed }, { status: OrderStatus.Cancelled }, { status: OrderStatus.Expired },
    { maker: contractAddress }, { chainId: 1 }, { historyKey: "mock:sample" },
  ]) {
    const { client, wallet, order, writes } = fixture();
    const invalid = { ...order, ...patch };
    await assert.rejects(cancelOrder(client, wallet, invalid, account));
    await assert.rejects(cancelOrderBatch(client, wallet, [invalid], account));
    assert.equal(writes.length, 0);
    assert.equal(isSubmissionBusy(), false);
  }
});

test("wallet account or network changes reject before writing and release both locks", async () => {
  for (const cancel of [cancelOrder, (client, wallet, order, account) => cancelOrderBatch(client, wallet, [order], account)]) {
    const { client, wallet, order, writes } = fixture();
    wallet.assertContext = async () => { throw new Error("Wallet account or network changed"); };
    await assert.rejects(cancel(client, wallet, order, account), /account or network changed/);
    assert.equal(writes.length, 0);
    assert.equal(isSubmissionBusy(), false);
    wallet.assertContext = async () => {};
    assert.equal(await cancel(client, wallet, order, account), hash);
  }
});

test("orders that fill during wallet validation cannot be cancelled", async () => {
  for (const cancel of [cancelOrder, (client, wallet, order, account) => cancelOrderBatch(client, wallet, [order], account)]) {
    const { client, wallet, order, writes } = fixture();
    wallet.assertContext = async () => { order.status = OrderStatus.Completed; };
    await assert.rejects(cancel(client, wallet, order, account), /no longer open/);
    assert.equal(writes.length, 0);
    assert.equal(isSubmissionBusy(), false);
  }
});

test("wallet rejection or a reverted cancellation releases locks and allows retry", async () => {
  for (const cancel of [cancelOrder, (client, wallet, order, account) => cancelOrderBatch(client, wallet, [order], account)]) {
    const { client, wallet, order } = fixture();
    wallet.cancelOrder = async () => { throw new Error("Cancellation reverted"); };
    await assert.rejects(cancel(client, wallet, order, account), /Cancellation reverted/);
    assert.equal(isSubmissionBusy(), false);
    wallet.cancelOrder = async () => hash;
    assert.equal(await cancel(client, wallet, order, account), hash);
  }
});

test("a batch combines v2 digests on the same contract and locks each member until receipt", async () => {
  const { client, wallet, order, writes } = fixture();
  const second = { ...order, historyKey: "2:56:second" };
  let confirm;
  wallet.cancelOrder = request => { writes.push(request); return new Promise(resolve => { confirm = resolve; }); };
  const pending = cancelOrderBatch(client, wallet, [order, second], account);
  await tick();
  assert.deepEqual(writes[0].args, [[order.historyKey, second.historyKey]]);
  await assert.rejects(cancelOrder(client, wallet, second, account), /already pending/);
  assert.equal(isSubmissionBusy(), true);
  confirm(hash);
  assert.equal(await pending, hash);
  assert.equal(isSubmissionBusy(), false);
  wallet.cancelOrder = async () => hash;
  assert.equal(await cancelOrder(client, wallet, second, account), hash);
});

test("batch cancellation retains legacy arguments for one order and rejects incompatible batches", async () => {
  const { client, wallet, order, writes } = fixture();
  const legacy = { ...order, version: 1, historyKey: "1:56:legacy" };
  assert.equal(await cancelOrderBatch(client, wallet, [legacy], account), hash);
  assert.deepEqual(writes[0].args, [legacy.historyKey]);
  await assert.rejects(cancelOrderBatch(client, wallet, [order, legacy], account), /separate cancellations/);
  const sdkRequest = client.getCancelOrderRequest;
  client.getCancelOrderRequest = candidate => ({ ...sdkRequest(candidate), contractAddress: candidate === order ? contractAddress : account });
  await assert.rejects(cancelOrderBatch(client, wallet, [order, { ...order, historyKey: "other" }], account), /separate cancellations/);
  assert.equal(writes.length, 1);
  assert.equal(isSubmissionBusy(), false);
});
