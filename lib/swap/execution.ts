import type { Quote } from "@orbs-network/liquidity-hub-sdk";

export interface SwapIntent {
  account: string;
  chainId: number;
  inputToken: string;
  outputToken: string;
  amount: string;
  native: boolean;
}

const sameAddress = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const positiveInteger = (value: string) => /^\d+$/.test(value) && BigInt(value) > BigInt(0);

export function assertSwapQuote(quote: Quote, intent: SwapIntent, now = Date.now()) {
  if (quote.error || !sameAddress(quote.user, intent.account) ||
      !sameAddress(quote.inToken, intent.inputToken) || !sameAddress(quote.outToken, intent.outputToken) ||
      quote.inAmount !== intent.amount || Number(quote.eip712?.domain.chainId) !== intent.chainId ||
      !positiveInteger(quote.minAmountOut) || !positiveInteger(quote.outAmount)) {
    throw new Error("Quote does not match the reviewed swap. Request a new quote.");
  }
  if (!Number.isFinite(quote.timestamp) || now - quote.timestamp >= 60_000 || quote.timestamp > now + 5_000) {
    throw new Error("Quote expired. Request a new quote before signing.");
  }
}

export interface SwapExecution {
  intent: SwapIntent;
  quote: Quote;
  assertWallet(): Promise<void>;
  hasAllowance(): Promise<boolean>;
  wrap(amount: string): Promise<unknown>;
  approve(): Promise<unknown>;
  refreshQuote(): Promise<Quote | undefined>;
  sign(quote: Quote): Promise<`0x${string}`>;
  submit(quote: Quote, signature: `0x${string}`): Promise<string>;
  confirm(hash: `0x${string}`): Promise<unknown>;
  onPlan(steps: number): void;
  onStep(step: "WRAP" | "APPROVE" | "SWAP", index: number): void;
  onWrapped(): void;
  onApproved(): void;
  onSubmitted(hash: `0x${string}`): void;
}

/** One lock across all mounted submit controls; retain confirmed wraps after rejection. */
export function createSwapExecutor() {
  let busy = false;
  let wrapped: { key: string; amount: bigint } | undefined;
  async function execute(input: SwapExecution) {
    if (busy) throw new Error("A swap is already being submitted");
    busy = true;
    const intent = { ...input.intent };
    let quote = structuredClone(input.quote);
    const key = `${intent.chainId}:${intent.account.toLowerCase()}:${intent.inputToken.toLowerCase()}`;
    let submitted = false;
    try {
      if (!positiveInteger(intent.amount)) throw new Error("Enter a valid swap amount");
      const reviewedMinimum = BigInt(quote.minAmountOut);
      const freshQuote = async () => {
        if (Date.now() - quote.timestamp >= 60_000 || !Number.isFinite(quote.timestamp)) {
          const fresh = await input.refreshQuote();
          if (!fresh || BigInt(fresh.minAmountOut) < reviewedMinimum) {
            throw new Error("Quote changed. Review the new price before continuing.");
          }
          quote = structuredClone(fresh);
        }
        assertSwapQuote(quote, intent);
      };
      await input.assertWallet();
      await freshQuote();
      const approved = await input.hasAllowance();
      const alreadyWrapped = wrapped?.key === key ? wrapped.amount : BigInt(0);
      const amount = BigInt(intent.amount);
      const wrapAmount = intent.native && amount > alreadyWrapped ? amount - alreadyWrapped : BigInt(0);
      input.onPlan(1 + Number(wrapAmount > BigInt(0)) + Number(!approved));
      let index = 0;
      if (wrapAmount > BigInt(0)) {
        await input.assertWallet();
        input.onStep("WRAP", index++);
        await input.wrap(wrapAmount.toString());
        wrapped = { key, amount: alreadyWrapped + wrapAmount };
        input.onWrapped();
      }
      if (!approved) {
        await input.assertWallet();
        input.onStep("APPROVE", index++);
        await input.approve();
        input.onApproved();
      }
      await freshQuote();
      await input.assertWallet();
      input.onStep("SWAP", index);
      const signature = await input.sign(quote);
      await input.assertWallet();
      assertSwapQuote(quote, intent);
      submitted = true;
      // Once submitted, a lost response must not treat the wrapped funds as unspent.
      wrapped = undefined;
      const hash = await input.submit(quote, signature);
      if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) throw new Error("Invalid transaction hash");
      input.onSubmitted(hash as `0x${string}`);
      const receipt = await input.confirm(hash as `0x${string}`);
      return { receipt, txHash: hash as `0x${string}` };
    } catch (error) {
      if (submitted) throw new Error("Swap confirmation is unavailable. Check wallet activity before retrying.", { cause: error });
      throw error;
    } finally { busy = false; }
  }
  return { execute, isBusy: () => busy };
}
