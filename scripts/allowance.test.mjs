import assert from "node:assert/strict";
import test from "node:test";
import { confirmAllowance } from "../lib/spot/allowance.ts";

const options = { message: "Allowance is insufficient", delayMillis: 0 };

test("confirmed approval tolerates lagging reads and stops when allowance is visible", async () => {
  let reads = 0;
  await confirmAllowance(async () => ++reads === 3, options);
  assert.equal(reads, 3);
});

test("insufficient allowance stops after the configured bound", async () => {
  let reads = 0;
  await assert.rejects(confirmAllowance(async () => { reads++; return false; }, options), /Allowance is insufficient/);
  assert.equal(reads, 4);
});

test("wallet context or RPC failures are not retried as stale allowance", async () => {
  let reads = 0;
  const failure = new Error("Wallet changed");
  await assert.rejects(confirmAllowance(async () => { reads++; throw failure; }, options), error => error === failure);
  assert.equal(reads, 1);
});

test("cancelling the retry delay prevents another allowance read", async () => {
  const controller = new AbortController();
  let reads = 0;
  const pending = confirmAllowance(async () => {
    reads++;
    setImmediate(() => controller.abort(new Error("Attempt stopped")));
    return false;
  }, { ...options, delayMillis: 60_000, signal: controller.signal });
  await assert.rejects(pending, /Attempt stopped/);
  assert.equal(reads, 1);
});
