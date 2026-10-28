import {
  getMinimumOutputAmount,
  isNativeAddress,
  isQuoteFresh,
  OrderSettlementError,
  waitForOrder,
  type Order,
  type OrderSigningRequest,
  type SpotClient,
} from "@orbs-network/spot-ui";
import type { BestTradeQuote } from "../types";
import { acquireSubmissionLock, isSubmissionBusy } from "../spot/submission-lock.js";

export interface SwapIntent {
  account: string;
  chainId: number;
  /** ERC-20 address, including the wrapped token for native input. */
  inputToken: string;
  /** Host form address before native input normalization. */
  originalInputToken?: string;
  outputToken: string;
  amount: string;
  native: boolean;
}

const MAX_QUOTE_AGE_MILLIS = 60_000;
const sameAddress = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const positiveInteger = (value: string) => /^\d+$/.test(value) && BigInt(value) > BigInt(0);

export class QuoteUpdatedError extends Error {
  constructor(public previous: BestTradeQuote, public next: BestTradeQuote) {
    super("Quote changed. Review the new price before continuing.");
    this.name = "QuoteUpdatedError";
  }
}

/** POST failures cannot be handled as safe wallet cancellations, even if their cause was rejected. */
export class SwapSubmissionUncertainError extends Error {
  constructor(cause: unknown) {
    super("Swap status is uncertain. Check order history before retrying; the order may have been accepted.", { cause });
    this.name = "SwapSubmissionUncertainError";
  }
}

function assertSwapQuoteIdentity(quote: BestTradeQuote, intent: SwapIntent): void {
  const original = quote.originalQuote;
  const request = original.request;
  const hostInputMatches = intent.originalInputToken
    ? sameAddress(quote.inToken, intent.originalInputToken)
    : intent.native ? isNativeAddress(quote.inToken) : sameAddress(quote.inToken, intent.inputToken);
  if (!hostInputMatches || !sameAddress(request.user, intent.account) ||
      !sameAddress(request.inToken, intent.inputToken) || !sameAddress(request.outToken, intent.outputToken) ||
      !sameAddress(quote.outToken, intent.outputToken) || quote.inAmount !== intent.amount ||
      request.inAmount !== intent.amount || request.chainId !== intent.chainId ||
      request.slippage !== quote.slippage || !positiveInteger(quote.minAmountOut) ||
      !positiveInteger(quote.outAmount) || quote.outAmount !== original.netAmountOut ||
      quote.minAmountOut !== getMinimumOutputAmount(original.netAmountOut, quote.slippage)) {
    throw new Error("Quote does not match the reviewed swap. Request a new quote.");
  }
}

export function assertSwapQuote(quote: BestTradeQuote, intent: SwapIntent, now = Date.now()): void {
  assertSwapQuoteIdentity(quote, intent);
  if (!isQuoteFresh(quote.originalQuote, MAX_QUOTE_AGE_MILLIS, now)) {
    throw new Error("Quote expired. Request a new quote before signing.");
  }
}

export type SwapExecutionStep = "WRAP" | "APPROVE" | "SWAP";

export interface SwapExecution {
  intent: SwapIntent;
  quote: BestTradeQuote;
  client: SpotClient;
  signal?: AbortSignal;
  /** A host can reserve wallet ownership before asynchronous configuration reads. */
  releaseWalletLock?: () => void;
  assertWallet(): Promise<void>;
  hasAllowance(): Promise<boolean>;
  getWrappedBalance?(): Promise<string>;
  hasInputBalance?(amount: string): Promise<boolean>;
  wrap(amount: string): Promise<unknown>;
  approve(): Promise<unknown>;
  refreshQuote(): Promise<BestTradeQuote | undefined>;
  sign(request: OrderSigningRequest): Promise<`0x${string}`>;
  onPlan(steps: SwapExecutionStep[]): void;
  onStep(step: SwapExecutionStep, index: number): void;
  onWrapped(): void;
  onApproved(): void;
  onSubmitting?(): void;
  onSubmitted(order: Order): void;
}

/** Shared by the production form and the developer's staged wallet flow. */
export function acquireSwapExecutionLock(owner: object): () => void {
  return acquireSubmissionLock(owner);
}

export const isSwapExecutionBusy = isSubmissionBusy;

interface SwapExecutorOptions {
  settle?: typeof waitForOrder;
  allowanceRetryDelayMillis?: number;
}

/** Retain confirmed wraps after rejection; serialize wallet steps through signing. */
export function createSwapExecutor({
  settle = waitForOrder,
  allowanceRetryDelayMillis = 500,
}: SwapExecutorOptions = {}) {
  let wrapped: { key: string; amount: bigint } | undefined;
  async function execute(source: SwapExecution): Promise<{ order: Order }> {
    const release = source.releaseWalletLock ?? acquireSwapExecutionLock({});
    // Capture the client, callbacks and reviewed data before the first await.
    const input = { ...source, intent: { ...source.intent } };
    const { intent, client, signal } = input;
    let submitted = false;
    try {
      const reviewedQuote = structuredClone(input.quote);
      let quote = structuredClone(reviewedQuote);
      const key = `${intent.chainId}:${intent.account.toLowerCase()}:${intent.inputToken.toLowerCase()}:${intent.amount}`;
      const checkActive = () => {
        if (signal?.aborted) throw new DOMException("Swap execution aborted", "AbortError");
      };
      const assertWallet = async () => {
        checkActive();
        await input.assertWallet();
        checkActive();
      };
      checkActive();
      if (!positiveInteger(intent.amount)) throw new Error("Enter a valid swap amount");
      const reviewedMinimum = reviewedQuote.minAmountOut;
      const assertIdentity = (candidate: BestTradeQuote, requireFresh = true) => {
        if (requireFresh) assertSwapQuote(candidate, intent);
        else assertSwapQuoteIdentity(candidate, intent);
        if (client.chainId !== intent.chainId || candidate.originalQuote.request.partner !== client.partner ||
            candidate.slippage !== reviewedQuote.slippage) {
          throw new Error("Quote does not match the reviewed swap. Request a new quote.");
        }
      };
      // A fresh response cannot make a quote reviewed for another signer or
      // form eligible for this attempt.
      assertIdentity(reviewedQuote, false);
      const freshQuote = async () => {
        checkActive();
        if (!isQuoteFresh(quote.originalQuote, MAX_QUOTE_AGE_MILLIS)) {
          const fresh = await input.refreshQuote();
          checkActive();
          if (!fresh) throw new Error("Quote is unavailable. Request a new quote.");
          assertIdentity(fresh);
          if (BigInt(fresh.minAmountOut) < BigInt(reviewedMinimum) ||
              BigInt(fresh.outAmount) < BigInt(reviewedQuote.outAmount)) {
            throw new QuoteUpdatedError(reviewedQuote, structuredClone(fresh));
          }
          quote = structuredClone(fresh);
        }
        assertIdentity(quote);
      };
      await assertWallet();
      await freshQuote();
      checkActive();
      const approved = await input.hasAllowance();
      checkActive();
      const amount = BigInt(intent.amount);
      let alreadyWrapped = BigInt(0);
      if (intent.native && wrapped?.key === key && input.getWrappedBalance) {
        const wrappedBalance = await input.getWrappedBalance();
        checkActive();
        if (BigInt(wrappedBalance) >= amount) alreadyWrapped = amount;
      }
      const wrapAmount = intent.native && amount > alreadyWrapped ? amount - alreadyWrapped : BigInt(0);
      checkActive();
      if (input.hasInputBalance && !await input.hasInputBalance((intent.native ? wrapAmount : amount).toString())) {
        throw new Error("Insufficient input balance for this swap");
      }
      checkActive();
      const steps: SwapExecutionStep[] = [];
      if (wrapAmount > BigInt(0)) steps.push("WRAP");
      if (!approved) steps.push("APPROVE");
      steps.push("SWAP");
      checkActive();
      input.onPlan(steps);
      let index = 0;
      if (wrapAmount > BigInt(0)) {
        await assertWallet();
        input.onStep("WRAP", index++);
        checkActive();
        await input.wrap(wrapAmount.toString());
        wrapped = { key, amount: alreadyWrapped + wrapAmount };
        // A late receipt still confirms funds for the captured account, even
        // when its controller was aborted while the transaction was pending.
        input.onWrapped();
        checkActive();
      }
      if (!approved) {
        await assertWallet();
        input.onStep("APPROVE", index++);
        checkActive();
        await input.approve();
        checkActive();
      }
      // Confirmed receipts and allowance reads can briefly disagree. Bound the
      // rereads and never issue another approval automatically.
      let sufficient = false;
      for (let attempt = 0; attempt < 4; attempt++) {
        await assertWallet();
        if (await input.hasAllowance()) {
          checkActive();
          sufficient = true;
          break;
        }
        checkActive();
        if (attempt < 3 && allowanceRetryDelayMillis > 0) {
          await new Promise(resolve => setTimeout(resolve, allowanceRetryDelayMillis));
        }
      }
      if (!sufficient) throw new Error("Confirmed allowance is still below the swap amount");
      if (!approved) input.onApproved();
      const assertSpendBalance = async () => {
        checkActive();
        const sufficient = intent.native
          ? !input.getWrappedBalance || BigInt(await input.getWrappedBalance()) >= amount
          : !input.hasInputBalance || await input.hasInputBalance(amount.toString());
        checkActive();
        if (!sufficient) throw new Error("Insufficient input balance for this swap");
      };
      await freshQuote();
      await assertSpendBalance();
      await assertWallet();
      input.onStep("SWAP", index);
      checkActive();
      const prepared = client.prepareSwap({
        quote: quote.originalQuote,
        minimumOutputAmountRaw: reviewedMinimum,
        swapperAddress: intent.account,
        maxQuoteAgeMillis: MAX_QUOTE_AGE_MILLIS,
      });
      checkActive();
      const signature = await input.sign(prepared.signingRequest);
      await assertWallet();
      if (!isQuoteFresh(quote.originalQuote, MAX_QUOTE_AGE_MILLIS)) {
        const fresh = await input.refreshQuote();
        checkActive();
        if (!fresh) throw new Error("Quote expired. Request a new quote.");
        assertIdentity(fresh);
        // Never reuse a signature after replacing its quote, even at a better price.
        throw new QuoteUpdatedError(reviewedQuote, structuredClone(fresh));
      }
      await assertSpendBalance();
      await assertWallet();
      assertIdentity(quote);
      checkActive();
      submitted = true;
      // A lost POST response may still have spent these wrapped funds.
      wrapped = undefined;
      // No wallet writes remain. Another draft can submit while this POST and
      // its settlement finish, without sharing this attempt's state or toast.
      release();
      input.onSubmitting?.();
      const order = await client.submitOrder(prepared.order, signature);
      // Keep the accepted ID even when an abort happened while POST was pending.
      input.onSubmitted(order);
      checkActive();
      const completedOrder = await settle({ order, signal });
      checkActive();
      return { order: completedOrder };
    } catch (error) {
      if (error instanceof OrderSettlementError) throw error;
      if (submitted) {
        throw new SwapSubmissionUncertainError(error);
      }
      throw error;
    } finally {
      release();
    }
  }
  return { execute, isBusy: isSwapExecutionBusy };
}
