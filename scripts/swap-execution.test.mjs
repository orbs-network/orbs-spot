import assert from "node:assert/strict";
import test from "node:test";
import { OrderStatus } from "@orbs-network/spot-ui";
import { OrderSettlementError } from "../lib/swap/settlement.ts";
import {
  acquireSwapExecutionLock,
  assertSwapQuote,
  createSwapExecutor,
  isSwapExecutionBusy,
  QuoteUpdatedError,
  SwapSubmissionUncertainError,
} from "../lib/swap/execution.ts";
import { isUserRejectedError } from "../lib/tx-rejection.ts";
import { assertMinimumQuoteValue } from "../lib/swap/quote-valuation.ts";
import { createSubmissionToast } from "../lib/spot/submission-toast.ts";

const nativeAddress = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

function gate() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

function reviewModal() {
  let open = true;
  const listeners = new Set();
  return {
    isModalOpen: () => open,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    close() { open = false; for (const listener of listeners) listener(); },
  };
}

function fixture({ native = false, approved = true } = {}) {
  const plans = [];
  const steps = [];
  const actions = [];
  const submitted = [];
  const intent = { account: "0x1111", chainId: 56, inputToken: "0x2222", outputToken: "0x3333", amount: "10", native,
    originalInputToken: native ? nativeAddress : "0x2222" };
  const originalQuote = { request: { user: intent.account, chainId: 56, partner: "quickswap", inToken: intent.inputToken,
    outToken: intent.outputToken, inAmount: "10", slippage: 5 }, receivedAt: Date.now(),
    amountOut: "21", netAmountOut: "20", minimumAmountOut: "18", feeAmount: "1" };
  const quote = { inToken: intent.originalInputToken, outToken: intent.outputToken,
    inAmount: "10", outAmount: "20", minAmountOut: "18", slippage: 5, originalQuote };
  const signingRequest = { signerAddress: intent.account, typedData: { message: { order: "exact prepared order" } } };
  const preparedOrder = signingRequest.typedData.message;
  const acceptedOrder = { id: "full-signed-order-id", chainId: 56, deadline: Date.now() + 900_000, status: OrderStatus.Open };
  const completedOrder = { ...acceptedOrder, status: OrderStatus.Completed, fills: [] };
  const preparations = [];
  const submissions = [];
  const settlements = [];
  let allowance = approved;
  const input = {
    intent, quote,
    client: {
      chainId: intent.chainId, partner: originalQuote.request.partner, spenderAddress: "0xspender",
      prepareSwap: async ({ quote, account: userAddress }) => {
        actions.push(["prepare"]);
        preparations.push({ quote, userAddress });
        return { order: preparedOrder, signingRequest, quote };
      },
      submitSwap: async (order, signature) => {
        actions.push(["submit"]);
        submissions.push([order, signature]);
        return acceptedOrder;
      },
    },
    assertWallet: async () => {},
    hasAllowance: async () => allowance,
    getWrappedBalance: async () => "10",
    hasInputBalance: async () => true,
    wrap: async amount => { actions.push(["wrap", amount]); },
    approve: async () => { actions.push(["approve"]); allowance = true; },
    refreshQuote: async () => quote,
    sign: async request => {
      assert.equal(request, signingRequest);
      actions.push(["sign"]);
      return "0xoriginal-signature";
    },
    onPlan: plan => plans.push(plan),
    onStep: (step, index) => steps.push([step, index]),
    onWrapped: () => {}, onApproved: () => {}, onSubmitted: order => submitted.push(order),
  };
  const settle = async params => {
    actions.push(["settle"]);
    settlements.push(params);
    assert.equal(params.order, acceptedOrder);
    return completedOrder;
  };
  const executor = createSwapExecutor({ settle, allowanceRetryDelayMillis: 0 });
  return { input, plans, steps, actions, executor, settle, preparations, submissions, settlements,
    submitted, signingRequest, preparedOrder, acceptedOrder, completedOrder };
}

function refreshedQuote(quote, outAmount = quote.outAmount, minAmountOut = quote.minAmountOut) {
  return { ...structuredClone(quote), outAmount,
    minAmountOut,
    originalQuote: { ...structuredClone(quote.originalQuote), receivedAt: Date.now(), netAmountOut: outAmount, minimumAmountOut: minAmountOut } };
}

test("swap progress exposes the complete wrap, approve and sign plan", async () => {
  const { input, plans, steps, actions, executor, preparations, submissions, preparedOrder, submitted, acceptedOrder } = fixture({ native: true, approved: false });
  await executor.execute(input);
  assert.deepEqual(plans, [["WRAP", "APPROVE", "SWAP"]]);
  assert.deepEqual(steps, [["WRAP", 0], ["APPROVE", 1], ["SWAP", 2]]);
  assert.deepEqual(actions, [["wrap", "10"], ["approve"], ["prepare"], ["sign"], ["submit"], ["settle"]]);
  assert.equal(preparations[0].quote.request.inToken, input.intent.inputToken);
  assert.equal(preparations[0].quote.minimumAmountOut, "18");
  assert.equal(preparations[0].userAddress, input.intent.account);
  assert.equal(submissions.length, 1);
  assert.equal(submissions[0][0], preparedOrder);
  assert.equal(submissions[0][1], "0xoriginal-signature");
  assert.deepEqual(submitted, [acceptedOrder]);
});

test("an approved ERC-20 swap resolves only with a completed order, without requiring a fill hash", async () => {
  const { input, plans, steps, actions, executor, completedOrder } = fixture();
  const result = await executor.execute(input);
  assert.deepEqual(plans, [["SWAP"]]);
  assert.deepEqual(steps, [["SWAP", 0]]);
  assert.deepEqual(actions, [["prepare"], ["sign"], ["submit"], ["settle"]]);
  assert.equal(result.order, completedOrder);
  assert.equal(result.order.fills.length, 0);
});

test("review hands off only after signing and final wallet, quote and balance validation, before POST", async () => {
  const { input, executor, acceptedOrder, completedOrder } = fixture();
  const review = reviewModal();
  const signingStarted = gate();
  const signature = gate();
  const walletCheckStarted = gate();
  const walletCheck = gate();
  const balanceCheckStarted = gate();
  const balanceCheck = gate();
  const postStarted = gate();
  const post = gate();
  let signed = false;
  let walletValidated = false;
  let balanceValidated = false;
  let quoteValidated = false;
  let handoffs = 0;
  input.sign = async () => {
    signingStarted.resolve();
    await signature.promise;
    signed = true;
    return "0xoriginal-signature";
  };
  input.assertWallet = async () => {
    if (!signed) return;
    walletCheckStarted.resolve();
    await walletCheck.promise;
    walletValidated = true;
  };
  input.hasInputBalance = async () => {
    if (!signed) return true;
    balanceCheckStarted.resolve();
    await balanceCheck.promise;
    balanceValidated = true;
    return true;
  };
  input.validateQuote = () => { if (signed) quoteValidated = true; };
  input.onSubmitting = () => {
    assert.equal(signed && walletValidated && balanceValidated && quoteValidated, true);
    handoffs++;
    review.close();
  };
  input.client.submitSwap = async () => {
    assert.equal(handoffs, 1);
    assert.equal(review.isModalOpen(), false);
    postStarted.resolve();
    return post.promise;
  };
  const pending = executor.execute(input);
  await signingStarted.promise;
  assert.equal(review.isModalOpen(), true);
  assert.equal(handoffs, 0);
  signature.resolve();
  await walletCheckStarted.promise;
  assert.equal(review.isModalOpen(), true);
  assert.equal(handoffs, 0);
  walletCheck.resolve();
  await balanceCheckStarted.promise;
  assert.equal(review.isModalOpen(), true);
  assert.equal(handoffs, 0);
  balanceCheck.resolve();
  await postStarted.promise;
  assert.equal(handoffs, 1);
  post.resolve(acceptedOrder);
  assert.equal((await pending).order, completedOrder);
});

test("synchronous review close releases progress and fast settlement success notifications", async () => {
  const { input, executor, completedOrder } = fixture();
  const review = reviewModal();
  const notifications = createSubmissionToast(review);
  const shown = [];
  const signingStarted = gate();
  const signature = gate();
  notifications.publish(() => shown.push("preparing"));
  input.sign = async () => {
    signingStarted.resolve();
    return signature.promise;
  };
  input.onSubmitting = () => {
    notifications.publish(() => shown.push("swap in progress"));
    assert.deepEqual(shown, []);
    review.close();
  };
  const pending = executor.execute(input).then(result => {
    notifications.publishSuccess(() => shown.push("completed"));
    return result;
  });
  await signingStarted.promise;
  assert.equal(review.isModalOpen(), true);
  assert.deepEqual(shown, []);
  signature.resolve("0xoriginal-signature");
  assert.equal((await pending).order, completedOrder);
  assert.equal(review.isModalOpen(), false);
  assert.equal(notifications.isDeferred(), false);
  assert.deepEqual(shown, ["swap in progress", "completed"]);
});

test("quote identity rejects stale form, signer, chain, partner, token and slippage inputs before wallet writes", async () => {
  const changes = [
    input => { input.quote.inAmount = "11"; },
    input => { input.quote.originalQuote.request.user = "0xother"; },
    input => { input.quote.originalQuote.request.chainId = 1; },
    input => { input.quote.originalQuote.request.partner = "other"; },
    input => { input.quote.originalQuote.request.inToken = "0xother"; },
    input => { input.quote.originalQuote.request.outToken = "0xother"; },
    input => { input.quote.originalQuote.request.inAmount = "11"; },
    input => { input.quote.originalQuote.request.slippage = 1; },
    input => { input.quote.inToken = "0xother"; },
    input => { input.quote.outAmount = "999"; },
    input => { input.quote.minAmountOut = "1"; },
    input => { input.quote.originalQuote.minimumAmountOut = "1"; },
    input => { input.quote.minAmountOut = input.quote.originalQuote.minimumAmountOut = "21"; },
    input => { input.client.chainId = 1; },
  ];
  for (const change of changes) {
    const { input, executor, actions } = fixture();
    change(input);
    await assert.rejects(executor.execute(input), /does not match the reviewed swap/);
    assert.deepEqual(actions, []);
  }
});

test("native form addresses are distinct from the quoted wrapped ERC-20", () => {
  const { input } = fixture({ native: true });
  assertSwapQuote(input.quote, input.intent);
  delete input.intent.originalInputToken;
  assertSwapQuote(input.quote, input.intent);
  input.quote.originalQuote.request.inToken = nativeAddress;
  assert.throws(() => assertSwapQuote(input.quote, input.intent), /does not match/);
});

test("a refreshed better quote signs its service minimum without weakening the reviewed minimum", async () => {
  const { input, executor, preparations } = fixture();
  input.quote.originalQuote.receivedAt -= 60_001;
  input.refreshQuote = async () => refreshedQuote(input.quote, "30", "27");
  await executor.execute(input);
  assert.equal(preparations[0].quote.netAmountOut, "30");
  assert.equal(preparations[0].quote.minimumAmountOut, "27");
});

test("quote USD validation uses the captured review and rechecks refreshed metadata before wallet writes", async () => {
  for (const inputAmountUsd of [undefined, "9.999999999999999999"]) {
    const { input, executor, actions } = fixture({ native: true, approved: false });
    input.quote.originalQuote.inputAmountUsd = "10";
    input.quote.originalQuote.netAmountOutUsd = "20";
    input.quote.originalQuote.receivedAt -= 60_001;
    input.validateQuote = quote => assertMinimumQuoteValue(quote, 10);
    input.refreshQuote = async () => {
      const fresh = refreshedQuote(input.quote, "30", "27");
      fresh.originalQuote.inputAmountUsd = inputAmountUsd;
      return fresh;
    };
    await assert.rejects(executor.execute(input), /at least \$10/);
    assert.deepEqual(actions, []);
  }
});

test("refresh cannot repair an expired quote that was reviewed for another signer", async () => {
  const { input, executor, actions } = fixture();
  input.quote.originalQuote.receivedAt -= 60_001;
  input.quote.originalQuote.request.user = "0xother";
  input.refreshQuote = async () => {
    throw new Error("The mismatched reviewed quote must be rejected before refresh");
  };
  await assert.rejects(executor.execute(input), /does not match the reviewed swap/);
  assert.deepEqual(actions, []);
});

test("a refreshed worse quote requires review before wrapping, approval or signing", async () => {
  const { input, executor, actions } = fixture({ native: true, approved: false });
  input.quote.originalQuote.receivedAt -= 60_001;
  input.refreshQuote = async () => refreshedQuote(input.quote, "19");
  await assert.rejects(executor.execute(input), error => {
    assert.ok(error instanceof QuoteUpdatedError);
    assert.equal(error.previous.outAmount, "20");
    assert.equal(error.next.outAmount, "19");
    return true;
  });
  assert.deepEqual(actions, []);
});

test("a refreshed lower service minimum requires review even when net output improves", async () => {
  const { input, executor, actions } = fixture({ native: true, approved: false });
  input.quote.originalQuote.receivedAt -= 60_001;
  input.refreshQuote = async () => refreshedQuote(input.quote, "30", "17");
  await assert.rejects(executor.execute(input), error => {
    assert.ok(error instanceof QuoteUpdatedError);
    assert.equal(error.previous.minAmountOut, "18");
    assert.equal(error.next.minAmountOut, "17");
    return true;
  });
  assert.deepEqual(actions, []);
});

test("expiration while the wallet signs requires another review and never posts the signature", async t => {
  let now = Date.now();
  t.mock.method(Date, "now", () => now);
  const { input, executor, submissions } = fixture();
  let handoffs = 0;
  input.onSubmitting = () => { handoffs++; };
  input.sign = async () => { now += 60_001; return "0xoriginal-signature"; };
  input.refreshQuote = async () => refreshedQuote(input.quote, "30");
  await assert.rejects(executor.execute(input), QuoteUpdatedError);
  assert.equal(submissions.length, 0);
  assert.equal(handoffs, 0);
});

test("the reviewed quote, intent, client and callbacks remain fixed while wallet checks wait", async () => {
  const { input, executor, preparations, submissions } = fixture();
  let resume;
  const gate = new Promise(resolve => { resume = resolve; });
  input.assertWallet = async () => gate;
  const pending = executor.execute(input);
  input.quote.minAmountOut = "1";
  input.quote.originalQuote.request.inAmount = "99";
  input.intent.amount = "99";
  input.client = { submitSwap: async () => { throw new Error("wrong client"); } };
  input.sign = async () => { throw new Error("wrong callback"); };
  resume();
  await pending;
  assert.equal(preparations[0].quote.minimumAmountOut, "18");
  assert.equal(preparations[0].quote.request.inAmount, "10");
  assert.equal(submissions.length, 1);
});

test("allowance is verified after approval with bounded retry and one approval only", async () => {
  const { input, executor, actions } = fixture({ approved: false });
  let reads = 0;
  input.hasAllowance = async () => ++reads >= 4;
  await executor.execute(input);
  assert.equal(reads, 4);
  assert.equal(actions.filter(([action]) => action === "approve").length, 1);
  assert.equal(actions.filter(([action]) => action === "prepare").length, 1);
});

test("an insufficient confirmed allowance stops before preparation after four rereads", async () => {
  const { input, executor, actions } = fixture({ approved: false });
  let reads = 0;
  input.hasAllowance = async () => { reads++; return false; };
  await assert.rejects(executor.execute(input), /Confirmed allowance/);
  assert.equal(reads, 5);
  assert.deepEqual(actions, [["approve"]]);
});

test("the shared lock prevents overlapping wallet prompts while a signature is pending", async () => {
  const { input, executor } = fixture();
  let finishSigning;
  let signingStarted;
  const signing = new Promise(resolve => { finishSigning = resolve; });
  const started = new Promise(resolve => { signingStarted = resolve; });
  input.sign = async () => { signingStarted(); return signing; };
  const pending = executor.execute(input);
  await started;
  assert.equal(executor.isBusy(), true);
  assert.equal(isSwapExecutionBusy(), true);
  await assert.rejects(executor.execute(input), /pending wallet request/);
  await assert.rejects(createSwapExecutor().execute(input), /pending wallet request/);
  assert.throws(() => acquireSwapExecutionLock({}), /pending wallet request/);
  finishSigning("0xoriginal-signature");
  await pending;
  assert.equal(executor.isBusy(), false);
});

test("signed swaps release the wallet lock before POST and settlement without unlocking a newer run", async () => {
  const first = fixture();
  let finishPost;
  let postStarted;
  let finishSettlement;
  let settlementStarted;
  const posted = new Promise(resolve => { finishPost = resolve; });
  const posting = new Promise(resolve => { postStarted = resolve; });
  const settled = new Promise(resolve => { finishSettlement = resolve; });
  const settling = new Promise(resolve => { settlementStarted = resolve; });
  let submittingNotifications = 0;
  first.input.onSubmitting = () => {
    submittingNotifications++;
    assert.equal(isSwapExecutionBusy(), false);
  };
  first.input.client.submitSwap = async () => { postStarted(); return posted; };
  const executor = createSwapExecutor({ settle: async params => {
    settlementStarted();
    await settled;
    return first.settle(params);
  } });
  const firstPending = executor.execute(first.input);
  await posting;
  assert.equal(submittingNotifications, 1);
  assert.equal(executor.isBusy(), false);
  assert.deepEqual(first.submitted, []);

  const second = fixture();
  let finishSigning;
  let signingStarted;
  const signing = new Promise(resolve => { finishSigning = resolve; });
  const secondStarted = new Promise(resolve => { signingStarted = resolve; });
  second.input.sign = async () => { signingStarted(); return signing; };
  const secondPending = second.executor.execute(second.input);
  await secondStarted;
  assert.equal(isSwapExecutionBusy(), true);

  finishPost(first.acceptedOrder);
  await settling;
  assert.deepEqual(first.submitted, [first.acceptedOrder]);
  assert.equal(isSwapExecutionBusy(), true);
  finishSettlement();
  assert.equal((await firstPending).order, first.completedOrder);
  // The first run's finally block must not release the second run's lock.
  assert.equal(isSwapExecutionBusy(), true);
  assert.throws(() => acquireSwapExecutionLock({}), /pending wallet request/);
  finishSigning("0xsecond-signature");
  assert.equal((await secondPending).order, second.completedOrder);
  assert.equal(isSwapExecutionBusy(), false);
});

test("developer session lock blocks execution and its release cannot unlock a later session", async () => {
  const release = acquireSwapExecutionLock({});
  const { executor, input } = fixture();
  await assert.rejects(executor.execute(input), /pending wallet request/);
  release();
  const releaseNext = acquireSwapExecutionLock({});
  release();
  assert.equal(isSwapExecutionBusy(), true);
  releaseNext();
  await executor.execute(input);
});

test("a wallet lock reserved before configuration is handed to the executor until submission", async () => {
  const { input, executor, acceptedOrder } = fixture();
  const release = acquireSwapExecutionLock({});
  input.releaseWalletLock = release;
  let submitting = false;
  input.onSubmitting = () => {
    submitting = true;
    assert.equal(isSwapExecutionBusy(), false);
  };
  input.client.submitSwap = async () => {
    assert.equal(submitting, true);
    return acceptedOrder;
  };
  await executor.execute(input);
  assert.equal(isSwapExecutionBusy(), false);

  const releaseNext = acquireSwapExecutionLock({});
  release();
  assert.equal(isSwapExecutionBusy(), true);
  releaseNext();
});

test("failure before signing releases a wallet lock reserved by the host", async () => {
  const { input, executor, actions } = fixture();
  input.releaseWalletLock = acquireSwapExecutionLock({});
  input.quote.inAmount = "wrong";
  await assert.rejects(executor.execute(input), /does not match/);
  assert.deepEqual(actions, []);
  assert.equal(isSwapExecutionBusy(), false);
});

test("an already aborted attempt performs no wallet work", async () => {
  const { input, executor, actions } = fixture({ native: true, approved: false });
  input.signal = AbortSignal.abort();
  input.assertWallet = async () => { throw new Error("wallet should not be checked"); };
  await assert.rejects(executor.execute(input), { name: "AbortError" });
  assert.deepEqual(actions, []);
  assert.equal(executor.isBusy(), false);
});

test("an abort after a confirmed wrap stops approval and retains the wrapped funds for retry", async () => {
  const { input, executor, actions } = fixture({ native: true, approved: false });
  const controller = new AbortController();
  let wrappedNotifications = 0;
  input.onWrapped = () => { wrappedNotifications++; };
  input.signal = controller.signal;
  input.wrap = async amount => { actions.push(["wrap", amount]); controller.abort(); };
  await assert.rejects(executor.execute(input), { name: "AbortError" });
  assert.deepEqual(actions, [["wrap", "10"]]);
  assert.equal(wrappedNotifications, 1);
  input.signal = new AbortController().signal;
  await executor.execute(input);
  assert.equal(actions.filter(([action]) => action === "wrap").length, 1);
});

test("an account change after signing prevents submission", async () => {
  const { input, executor, submissions } = fixture();
  let handoffs = 0;
  input.onSubmitting = () => { handoffs++; };
  let signed = false;
  input.sign = async () => { signed = true; return "0xsignature"; };
  input.assertWallet = async () => {
    if (signed) throw new Error("Wallet account or network changed");
  };
  await assert.rejects(executor.execute(input), /account or network changed/);
  assert.equal(submissions.length, 0);
  assert.equal(handoffs, 0);
});

test("an abort during submission preserves the accepted order before stopping tracking", async () => {
  const { input, executor, acceptedOrder, submitted, settlements } = fixture();
  const controller = new AbortController();
  input.signal = controller.signal;
  input.client.submitSwap = async () => { controller.abort(); return acceptedOrder; };
  await assert.rejects(executor.execute(input), /Check order history before retrying/);
  assert.deepEqual(submitted, [acceptedOrder]);
  assert.deepEqual(settlements, []);
});

test("a lost submission response is uncertain and never automatically retried", async () => {
  const { input, executor, submitted, settlements } = fixture();
  let submissions = 0;
  input.client.submitSwap = async () => { submissions++; throw new Error("Connection lost"); };
  await assert.rejects(executor.execute(input), error => {
    assert.ok(error instanceof SwapSubmissionUncertainError);
    assert.match(error.message, /status is uncertain.*Check order history/);
    assert.equal(error.cause.message, "Connection lost");
    return true;
  });
  assert.equal(submissions, 1);
  assert.deepEqual(submitted, []);
  assert.deepEqual(settlements, []);
});

test("a POST rejection remains typed submission uncertainty even when its cause resembles a wallet rejection", async () => {
  for (const cause of [Object.assign(new Error("User rejected request"), { code: 4001 }), new Error("Order request rejected")]) {
    const { input, executor } = fixture();
    input.client.submitSwap = async () => { throw cause; };
    await assert.rejects(executor.execute(input), error => {
      assert.ok(error instanceof SwapSubmissionUncertainError);
      assert.equal(error.cause, cause);
      assert.equal(isUserRejectedError(error), true);
      const safeWalletCancellation = !(error instanceof SwapSubmissionUncertainError) && isUserRejectedError(error);
      assert.equal(safeWalletCancellation, false);
      assert.match(error.message, /Check order history before retrying/);
      return true;
    });
  }
});

test("a wallet signature rejection before POST retains its safe cancellation identity", async () => {
  const { input, executor, submissions } = fixture();
  let handoffs = 0;
  input.onSubmitting = () => { handoffs++; };
  const rejection = Object.assign(new Error("User rejected signature"), { code: 4001 });
  input.sign = async () => { throw rejection; };
  await assert.rejects(executor.execute(input), error => {
    assert.equal(error, rejection);
    assert.equal(error instanceof SwapSubmissionUncertainError, false);
    assert.equal(isUserRejectedError(error), true);
    return true;
  });
  assert.deepEqual(submissions, []);
  assert.equal(handoffs, 0);
});

test("settlement receives the lifecycle signal and preserves typed terminal and uncertain failures", async () => {
  for (const reason of ["cancelled", "expired", "unconfirmed", "aborted"]) {
    const { input, acceptedOrder } = fixture();
    const controller = new AbortController();
    input.signal = controller.signal;
    const failure = new OrderSettlementError(`Settlement ${reason}`, reason, acceptedOrder.id);
    const executor = createSwapExecutor({ settle: async params => {
      assert.equal(params.signal, controller.signal);
      throw failure;
    } });
    await assert.rejects(executor.execute(input), error => error === failure);
    assert.equal(executor.isBusy(), false);
  }
});

test("a wrap followed by rejected signing is reused only for the same account, chain and input token", async () => {
  const { input, executor, actions } = fixture({ native: true });
  input.sign = async () => { throw new Error("User rejected signing"); };
  await assert.rejects(executor.execute(input), /User rejected signing/);
  await assert.rejects(executor.execute(input), /User rejected signing/);
  assert.equal(actions.filter(([action]) => action === "wrap").length, 1);
  input.intent.account = "0xother";
  input.quote.originalQuote.request.user = input.intent.account;
  await assert.rejects(executor.execute(input), /User rejected signing/);
  assert.equal(actions.filter(([action]) => action === "wrap").length, 2);
});

test("editing the amount after a confirmed wrap requires a complete new wrap", async () => {
  const { input, executor, actions } = fixture({ native: true });
  input.sign = async () => { throw new Error("User rejected signing"); };
  await assert.rejects(executor.execute(input), /User rejected signing/);
  input.intent.amount = "11";
  input.quote.inAmount = "11";
  input.quote.originalQuote.request.inAmount = "11";
  input.getWrappedBalance = async () => "100";
  await assert.rejects(executor.execute(input), /User rejected signing/);
  assert.deepEqual(actions.filter(([action]) => action === "wrap"), [["wrap", "10"], ["wrap", "11"]]);
});

test("wrap reuse requires a current sufficient wrapped balance", async () => {
  for (const canReadWrappedBalance of [false, true]) {
    const { input, executor, actions } = fixture({ native: true });
    input.sign = async () => { throw new Error("User rejected signing"); };
    await assert.rejects(executor.execute(input), /User rejected signing/);
    let reads = 0;
    input.getWrappedBalance = canReadWrappedBalance ? async () => ++reads === 1 ? "9" : "19" : undefined;
    await assert.rejects(executor.execute(input), /User rejected signing/);
    assert.deepEqual(actions.filter(([action]) => action === "wrap"), [["wrap", "10"], ["wrap", "10"]]);
  }
});

test("a balance spent during wrapping is detected before preparing the signature", async () => {
  const { input, executor, actions, preparations } = fixture({ native: true });
  input.getWrappedBalance = async () => "9";
  await assert.rejects(executor.execute(input), /Insufficient input balance/);
  assert.deepEqual(actions, [["wrap", "10"]]);
  assert.deepEqual(preparations, []);
});

test("an input balance spent while signing prevents submission", async () => {
  for (const native of [true, false]) {
    const { input, executor, submissions } = fixture({ native });
    let handoffs = 0;
    input.onSubmitting = () => { handoffs++; };
    let signed = false;
    input.sign = async () => { signed = true; return "0xsignature"; };
    input.getWrappedBalance = async () => signed ? "9" : "10";
    input.hasInputBalance = async () => !signed;
    await assert.rejects(executor.execute(input), /Insufficient input balance/);
    assert.deepEqual(submissions, []);
    assert.equal(handoffs, 0);
  }
});

test("live input balance is checked for the required native wrap or complete ERC-20 spend", async () => {
  for (const native of [false, true]) {
    const { input, executor, actions } = fixture({ native });
    input.hasInputBalance = async amount => { assert.equal(amount, "10"); return false; };
    await assert.rejects(executor.execute(input), /Insufficient input balance/);
    assert.deepEqual(actions, []);
  }
  const { input, executor } = fixture({ native: true });
  input.sign = async () => { throw new Error("User rejected signing"); };
  await assert.rejects(executor.execute(input), /User rejected signing/);
  input.hasInputBalance = async amount => { assert.equal(amount, "0"); return true; };
  await assert.rejects(executor.execute(input), /User rejected signing/);
});

test("submission uncertainty invalidates cached wraps before another manual attempt", async () => {
  const { input, executor, actions } = fixture({ native: true });
  input.client.submitSwap = async () => { throw new Error("Connection lost"); };
  await assert.rejects(executor.execute(input), /Check order history/);
  await assert.rejects(executor.execute(input), /Check order history/);
  assert.deepEqual(actions.filter(([action]) => action === "wrap"), [["wrap", "10"], ["wrap", "10"]]);
});

test("async preparation validates a refreshed quote before signing even when its minimum improves", async () => {
  const { input, executor, actions } = fixture();
  const prepare = input.client.prepareSwap;
  input.client.prepareSwap = async params => {
    const prepared = await prepare(params);
    return { ...prepared, quote: { ...prepared.quote, netAmountOut: "19", minimumAmountOut: "19" } };
  };
  await assert.rejects(executor.execute(input), error => error instanceof QuoteUpdatedError
    && error.next.outAmount === "19" && error.next.minAmountOut === "19");
  assert.equal(actions.some(([action]) => action === "sign" || action === "submit"), false);
});

test("a preparation refresh cannot substitute a different request identity", async () => {
  const { input, executor, actions } = fixture();
  const prepare = input.client.prepareSwap;
  input.client.prepareSwap = async params => {
    const prepared = await prepare(params);
    return { ...prepared, quote: { ...prepared.quote, request: { ...prepared.quote.request, chainId: 137 } } };
  };
  await assert.rejects(executor.execute(input), /does not match/);
  assert.equal(actions.some(([action]) => action === "sign" || action === "submit"), false);
});

test("abort during asynchronous preparation prevents a signing prompt", async () => {
  const { input, executor, actions } = fixture();
  const controller = new AbortController();
  input.signal = controller.signal;
  const prepare = input.client.prepareSwap;
  input.client.prepareSwap = async params => {
    assert.equal(params.signal, controller.signal);
    const prepared = await prepare(params);
    controller.abort();
    return prepared;
  };
  await assert.rejects(executor.execute(input), /aborted/);
  assert.equal(actions.some(([action]) => action === "sign" || action === "submit"), false);
});

test("host quote freshness agrees with SDK preparation's twenty-second refresh window", async () => {
  const { input, executor } = fixture();
  input.quote.originalQuote.receivedAt -= 20_001;
  let refreshes = 0;
  input.refreshQuote = async () => { refreshes++; return refreshedQuote(input.quote); };
  await executor.execute(input);
  assert.equal(refreshes, 1);
});
