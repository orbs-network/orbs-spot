import assert from "node:assert/strict";
import test from "node:test";
import { createSwapSubmissions, swapOrderKey } from "../lib/swap/submissions.ts";
import { acquireSubmissionLock, isSubmissionBusy, subscribeSubmissionLock } from "../lib/spot/submission-lock.js";

test("detaching a pending swap leaves its tracker active while a new draft owns the foreground", () => {
  const submissions = createSwapSubmissions();
  submissions.begin("first");
  submissions.track("first", 56, "0xAbC");
  submissions.detach("first");
  assert.equal(submissions.current(), undefined);
  assert.equal(submissions.isCurrent("first"), false);
  assert.deepEqual(submissions.getOrderKeys(), ["56:0xabc"]);

  submissions.begin("second");
  submissions.track("second", 1, "0xDeF");
  assert.equal(submissions.isCurrent("second"), true);
  // A late close or finish from the first run cannot take over the new draft.
  submissions.detach("first");
  submissions.finish("first");
  assert.equal(submissions.current(), "second");
  assert.equal(submissions.isCurrent("second"), true);
  assert.deepEqual(submissions.getOrderKeys(), ["1:0xdef"]);
  submissions.finish("first");
  assert.deepEqual(submissions.getOrderKeys(), ["1:0xdef"]);
  submissions.finish("second");
  assert.deepEqual(submissions.getOrderKeys(), []);
});

test("an accepted response arriving after modal close stays tracked independently", () => {
  const submissions = createSwapSubmissions();
  submissions.begin("posting");
  submissions.detach("posting");
  submissions.begin("next");
  submissions.track("posting", 56, "0xOrder");
  assert.equal(submissions.current(), "next");
  assert.deepEqual(submissions.getOrderKeys(), [swapOrderKey(56, "0xOrder")]);
  submissions.detach("next");
  assert.deepEqual(submissions.getOrderKeys(), ["56:0xorder"]);
  submissions.finish("posting");
  assert.deepEqual(submissions.getOrderKeys(), []);
});

test("tracker subscriptions expose stable snapshots and stop notifying after unsubscribe", () => {
  const submissions = createSwapSubmissions();
  const initial = submissions.getOrderKeys();
  assert.equal(submissions.getOrderKeys(), initial);
  assert.equal(submissions.getServerOrderKeys(), initial);
  const snapshots = [];
  const unsubscribe = submissions.subscribe(() => snapshots.push(submissions.getOrderKeys()));
  submissions.begin("run");
  submissions.detach("run");
  assert.equal(snapshots.length, 0);
  submissions.track("run", 56, "0xAbC");
  const active = submissions.getOrderKeys();
  assert.equal(submissions.getOrderKeys(), active);
  assert.notEqual(active, initial);
  assert.deepEqual(snapshots, [["56:0xabc"]]);
  assert.deepEqual(submissions.getServerOrderKeys(), []);
  submissions.finish("missing");
  assert.equal(snapshots.length, 1);
  submissions.finish("run");
  assert.deepEqual(snapshots, [["56:0xabc"], []]);
  unsubscribe();
  submissions.track("later", 1, "0xDef");
  assert.equal(snapshots.length, 2);
});

test("the shared wallet lock publishes handoffs and an old release cannot unlock a later request", () => {
  const states = [];
  const unsubscribe = subscribeSubmissionLock(() => states.push(isSubmissionBusy()));
  const releaseFirst = acquireSubmissionLock();
  assert.equal(isSubmissionBusy(), true);
  assert.throws(acquireSubmissionLock, /pending wallet request/);
  assert.deepEqual(states, [true]);
  releaseFirst();
  const releaseSecond = acquireSubmissionLock();
  releaseFirst();
  assert.equal(isSubmissionBusy(), true);
  assert.deepEqual(states, [true, false, true]);
  releaseSecond();
  assert.equal(isSubmissionBusy(), false);
  assert.deepEqual(states, [true, false, true, false]);
  unsubscribe();
  const releaseThird = acquireSubmissionLock();
  releaseThird();
  assert.deepEqual(states, [true, false, true, false]);
});
