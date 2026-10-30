import assert from "node:assert/strict";
import test from "node:test";
import { createSubmissionToast } from "../lib/spot/submission-toast.ts";

function modal() {
  let open = true;
  const listeners = new Set();
  return {
    isModalOpen: () => open,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    setOpen(value) { open = value; for (const listener of listeners) listener(); },
    listenerCount: () => listeners.size,
  };
}

test("submission stays silent until close, then shows only its latest progress", () => {
  const review = modal();
  const notifications = createSubmissionToast(review);
  const shown = [];
  notifications.publish(() => shown.push("preparing"));
  notifications.publish(() => shown.push("approving"));
  review.setOpen(true);
  assert.deepEqual(shown, []);
  notifications.publish(() => shown.push("swapping with transaction hash"));
  review.setOpen(false);
  assert.deepEqual(shown, ["swapping with transaction hash"]);
  assert.equal(notifications.isDeferred(), false);
  assert.equal(review.listenerCount(), 0);
  notifications.publishSuccess(() => shown.push("completed"));
  assert.deepEqual(shown, ["swapping with transaction hash", "completed"]);
});

test("success already visible in the modal clears pending progress or failure", () => {
  for (const pending of ["preparing", "failed"]) {
    const review = modal();
    const notifications = createSubmissionToast(review);
    const shown = [];
    notifications.publish(() => shown.push(pending));
    notifications.publishSuccess(() => shown.push("completed"));
    assert.deepEqual(shown, []);
    assert.equal(notifications.isDeferred(), true);
    assert.equal(review.listenerCount(), 1);
    review.setOpen(false);
    review.setOpen(false);
    assert.deepEqual(shown, []);
    assert.equal(notifications.isDeferred(), false);
    assert.equal(review.listenerCount(), 0);
  }
});

test("failure while the modal is open still replaces pending progress", () => {
  const review = modal();
  const notifications = createSubmissionToast(review);
  const shown = [];
  notifications.publish(() => shown.push("preparing"));
  notifications.publish(() => shown.push("failed"));
  assert.deepEqual(shown, []);
  review.setOpen(false);
  review.setOpen(false);
  assert.deepEqual(shown, ["failed"]);
});

test("another submission modal never hides or delays an earlier background submission", () => {
  const review = modal();
  const first = createSubmissionToast(review);
  const shown = [];
  first.publish(() => shown.push("first pending"));
  review.setOpen(false);
  review.setOpen(true);
  const second = createSubmissionToast(review);
  second.publish(() => shown.push("second pending"));
  first.publishSuccess(() => shown.push("first completed"));
  assert.deepEqual(shown, ["first pending", "first completed"]);
  review.setOpen(false);
  assert.deepEqual(shown, ["first pending", "first completed", "second pending"]);
});

test("closing before the first notification releases future updates immediately", () => {
  const review = modal();
  const notifications = createSubmissionToast(review);
  review.setOpen(false);
  const shown = [];
  notifications.publish(() => shown.push("pending"));
  notifications.publishSuccess(() => shown.push("completed"));
  assert.deepEqual(shown, ["pending", "completed"]);
  assert.equal(review.listenerCount(), 0);
});

test("recovered submissions with no modal show notifications immediately", () => {
  const review = modal();
  review.setOpen(false);
  const notifications = createSubmissionToast(review);
  const shown = [];
  notifications.publish(() => shown.push("pending"));
  notifications.publishSuccess(() => shown.push("completed"));
  assert.deepEqual(shown, ["pending", "completed"]);
  assert.equal(review.listenerCount(), 0);
});

test("dismissal replaces buffered progress without showing a stale loading notification", () => {
  const review = modal();
  const notifications = createSubmissionToast(review);
  const shown = [];
  notifications.publish(() => shown.push("loading"));
  notifications.publish(() => shown.push("dismissed"));
  review.setOpen(false);
  assert.deepEqual(shown, ["dismissed"]);
});

test("successful retry in the same modal shows no stale failure or progress on close", () => {
  const review = modal();
  let current;
  const forAttempt = () => {
    if (!current?.isDeferred()) current = createSubmissionToast(review);
    return current;
  };
  const shown = [];
  const first = forAttempt();
  first.publish(() => shown.push("first failed"));
  const retry = forAttempt();
  assert.equal(retry, first);
  retry.publish(() => shown.push("retry pending"));
  retry.publishSuccess(() => shown.push("retry completed"));
  assert.equal(retry.isDeferred(), true);
  review.setOpen(false);
  assert.deepEqual(shown, []);
  review.setOpen(true);
  const next = forAttempt();
  assert.notEqual(next, retry);
  next.publish(() => shown.push("next pending"));
  assert.deepEqual(shown, []);
  review.setOpen(false);
  assert.deepEqual(shown, ["next pending"]);
  next.publishSuccess(() => shown.push("next completed"));
  assert.deepEqual(shown, ["next pending", "next completed"]);
});
