import assert from "node:assert/strict";
import test from "node:test";
import { formatSubmissionError } from "../lib/submission-error.ts";

test("keeps plain error messages and normalizes whitespace", () => {
  assert.equal(formatSubmissionError("  Not enough funds.\n Try a smaller amount.  "), "Not enough funds. Try a smaller amount.");
  assert.equal(formatSubmissionError(), "The transaction could not be submitted. Please try again.");
});

test("prefers the wallet error details to RPC arguments and version metadata", () => {
  assert.equal(formatSubmissionError("An unknown RPC error occurred.\n\nRequest Arguments:\n  from: 0x123\n\nDetails: Your wallet has insufficient funds for network fees.\nVersion: viem@2"), "Your wallet has insufficient funds for network fees.");
  assert.equal(formatSubmissionError("The transaction failed.\n\nContract Call:\n address: 0x123\nVersion: viem@2"), "The transaction failed.");
});

test("retains the submission uncertainty warning after removing SDK metadata", () => {
  const notice = "Check order history before retrying; the order may have been accepted.";
  assert.equal(formatSubmissionError(`An unknown RPC error occurred.\nRequest Arguments:\n from: 0x123\nDetails: Network unavailable\nVersion: viem@2. ${notice}`), `Network unavailable ${notice}`);
  assert.equal(formatSubmissionError(`Network unavailable. ${notice}`), `Network unavailable. ${notice}`);
});

test("removes API error prefixes and numeric codes without hiding the reason", () => {
  assert.equal(formatSubmissionError("error:Order service is unavailable, code:503"), "Order service is unavailable");
});
