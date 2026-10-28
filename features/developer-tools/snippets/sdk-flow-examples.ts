import type { CodeSnippetOptions, JsonContainer } from "@/features/developer-tools/json-inspector";
import { getOrderFormFieldExplanation } from "@/features/developer-tools/order-form-field-explanations";

const TRANSACTION_CONFIRMATION_CODE = `async function waitForTransactionConfirmation(hash: Hash) {
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Transaction reverted");
  return receipt;
}`;

const WALLET_CONFIRMATION_HELPERS = `
const wrappedNativeAbi = parseAbi(["function deposit() payable"]);

${TRANSACTION_CONFIRMATION_CODE}`;

const ADVANCED_ALLOWANCE_CODE = `function readAllowance(inputToken: Address, account: Address, spender: Address) {
  return publicClient.readContract({
    address: inputToken, abi: erc20Abi, functionName: "allowance",
    args: [account, spender],
  });
}`;

const ADVANCED_WRAP_CODE = `async function wrapNativeToken(inputToken: Address, amount: bigint, account: Address) {
  const hash = await walletClient.writeContract({
    address: inputToken, abi: wrappedNativeAbi, functionName: "deposit",
    value: amount, account, chain: walletClient.chain,
  });
  await waitForTransactionConfirmation(hash);
}`;

const ADVANCED_APPROVAL_CODE = `async function approveToken(inputToken: Address, spender: Address, amount: bigint, account: Address) {
  let allowance = await readAllowance(inputToken, account, spender);
  if (allowance < amount) {
    const hash = await walletClient.writeContract({
      address: inputToken, abi: erc20Abi, functionName: "approve",
      args: [spender, amount], account, chain: walletClient.chain,
    });
    await waitForTransactionConfirmation(hash);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      allowance = await readAllowance(inputToken, account, spender);
      if (allowance >= amount) break;
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
    if (allowance < amount) {
      throw new Error("Approval is not yet available; check allowance before retrying");
    }
  }
}

${ADVANCED_ALLOWANCE_CODE}`;

const ADVANCED_SIGN_CODE = `const prepared = client.prepareOrder({
  form,
  inputTokenAddress: inputToken,
  outputTokenAddress: input.outputToken,
  swapperAddress: account,
});
const { signerAddress, typedData: message } = prepared.signingRequest;
const signature = await walletClient.signTypedData({
  domain: message.domain,
  types: message.types,
  primaryType: message.primaryType,
  message: { ...message.message },
  account: signerAddress,
});`;

const ADVANCED_SUBMIT_CODE = `// Submit exactly this prepared order with its unchanged signature, once.
return await client.submitOrder(prepared.order, signature);`;

const ADVANCED_CLIENT_HELPER = `let clientPromise: ReturnType<typeof createClient> | undefined;

function getClient() {
  clientPromise ??= createClient(partner, chain.id).catch((error) => {
    clientPromise = undefined;
    throw error;
  });
  return clientPromise;
}`;

export function formatAdvancedOrdersSdkFlow(data: JsonContainer = {}): string {
  const params = Array.isArray(data) ? {} : data.formParams ?? {};
  const calculationInput = JSON.stringify(params, null, 2)
    .replace(/"module": "(TWAP|LIMIT|STOP_LOSS|TAKE_PROFIT)"/, '"module": Module.$1');
  return `// advanced-orders.ts — requires @orbs-network/spot-ui 2.1.21 or later.
import { calculateOrder, createClient, isNativeAddress, Module, Partners } from "@orbs-network/spot-ui";
import { createPublicClient, createWalletClient, custom, erc20Abi, http, parseAbi, type Address, type EIP1193Provider, type Hash } from "viem";
import { polygon } from "viem/chains";

// Browser example: use the chain selected in the host wallet.
const chain = polygon;
const partner = Partners.External;
const provider = (window as Window & { ethereum?: EIP1193Provider }).ethereum;
if (!provider) throw new Error("A browser wallet is required");
const publicClient = createPublicClient({ chain, transport: http() });
const walletClient = createWalletClient({ chain, transport: custom(provider) });

export type OrderInput = {
  inputToken: Address;
  outputToken: Address;
  wrappedNativeToken: Address;
};

export async function createAdvancedOrderFlow(account: Address, input: OrderInput) {
  const form = calculateOrder(${calculationInput.split("\n").join("\n  ")});
  if (!form.canSubmit) throw new Error("Resolve the order form errors first");

  const client = await getClient();
  const sourceIsNative = isNativeAddress(input.inputToken);
  const inputToken = sourceIsNative ? input.wrappedNativeToken : input.inputToken;

  const amount = BigInt(form.inputAmount.raw);
  const spender = client.spenderAddress;

  if (sourceIsNative) await wrapNativeToken(inputToken, amount, account);
  await approveToken(inputToken, spender, amount, account);

${ADVANCED_SIGN_CODE.split("\n").map((line) => "  " + line).join("\n")}
${ADVANCED_SUBMIT_CODE.split("\n").map((line) => "  " + line).join("\n")}
}
${WALLET_CONFIRMATION_HELPERS}

// Host usage: const order = await createAdvancedOrderFlow(account, currentOrderInput);
// If submission is ambiguous, reconcile history before creating another order.


${ADVANCED_WRAP_CODE}

${ADVANCED_APPROVAL_CODE}

${ADVANCED_CLIENT_HELPER}
`;
}

export const ADVANCED_ORDERS_SDK_FLOW: CodeSnippetOptions = {
  copyLabel: "Copy code",
  fileName: "advanced-orders.ts",
  format: formatAdvancedOrdersSdkFlow,
  getFieldExplanation: getOrderFormFieldExplanation,
  inlineEditable: true,
  inlineEditRoot: ["formParams"],
  language: "TypeScript",
  syntaxLanguage: "typescript",
  hideStatusLabel: true,
};

export type AdvancedOrdersSdkStep = "check" | "wrap" | "approve" | "sign" | "submit";

export function formatAdvancedOrdersSdkStep(step: AdvancedOrdersSdkStep, data?: JsonContainer): string {
  const orderMessage = data && !Array.isArray(data) ? data.message : undefined;
  const signCode = orderMessage && typeof orderMessage === "object"
    ? ADVANCED_SIGN_CODE.replace(
        "  message: { ...message.message },",
        `  // message: { ...message.message },
  message: ${JSON.stringify(orderMessage, null, 2).split("\n").join("\n  ")},`,
      )
    : ADVANCED_SIGN_CODE;
  const payload = data && !Array.isArray(data) ? data : undefined;
  const submitCode = payload?.order && typeof payload.signature === "string"
    ? `import type { RePermitOrder } from "@orbs-network/spot-ui";

${payload.demo ? "// Demo only: the signature is a placeholder. This call is not executed." : "// Submit the exact prepared order and unchanged wallet signature shown below."}
return await client.submitOrder(
  ${JSON.stringify(payload.order, null, 2).split("\n").join("\n  ")} as RePermitOrder,
  ${JSON.stringify(payload.signature)}
);`
    : ADVANCED_SUBMIT_CODE;
  const sections = {
    check: ADVANCED_ALLOWANCE_CODE,
    wrap: ADVANCED_WRAP_CODE,
    approve: ADVANCED_APPROVAL_CODE,
    sign: `import type { CalculatedOrderForm } from "@orbs-network/spot-ui";

export async function signOrder(account: Address, input: OrderInput, form: CalculatedOrderForm) {
  const client = await getClient();
  if (!form.canSubmit) throw new Error("Resolve the order form errors first");
  const inputToken = isNativeAddress(input.inputToken) ? input.wrappedNativeToken : input.inputToken;

${signCode.split("\n").map((line) => "  " + line).join("\n")}
  return { prepared, signature };
}

${ADVANCED_CLIENT_HELPER}`,
    submit: submitCode,
  };
  return `// From advanced-orders.ts; uses the same clients and order values.
${sections[step]}
`;
}

const SWAP_ALLOWANCE_CODE = `async function hasEnoughAllowance(token: Address, account: Address, spender: Address, amount: bigint) {
  return await publicClient.readContract({
    address: token, abi: erc20Abi, functionName: "allowance", args: [account, spender],
  }) >= amount;
}`;

const SWAP_WRAP_CODE = `async function wrapNativeToken(token: Address, amount: bigint, account: Address) {
  const hash = await walletClient.writeContract({
    address: token, abi: wrappedNativeAbi, functionName: "deposit",
    value: amount, account, chain,
  });
  return waitForTransactionConfirmation(hash);
}`;

const SWAP_APPROVAL_CODE = `async function approveTokenIfNeeded(token: Address, account: Address, spender: Address, amount: bigint, signal?: AbortSignal) {
  if (await hasEnoughAllowance(token, account, spender, amount)) return;
  signal?.throwIfAborted();
  const hash = await walletClient.writeContract({
    address: token, abi: erc20Abi, functionName: "approve",
    args: [spender, amount], account, chain,
  });
  await waitForTransactionConfirmation(hash);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    signal?.throwIfAborted();
    if (await hasEnoughAllowance(token, account, spender, amount)) return;
    if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error("Approval is not available. Check allowance before retrying.");
}`;

const SWAP_SIGN_CODE = `// Refresh stale quotes after wallet transactions. Keep the originally reviewed minimum.
const prepared = client.prepareSwap({
  quote,
  minimumOutputAmountRaw: reviewedMinimum,
  swapperAddress: account,
  maxQuoteAgeMillis: 60_000,
});
const { signerAddress, typedData } = prepared.signingRequest;
const signature = await walletClient.signTypedData({
  ...typedData,
  message: { ...typedData.message },
  account: signerAddress,
});`;

const SWAP_SUBMIT_CODE = `// Submission accepts an order; it does not confirm a fill.
// Submit this exact prepared order and its original wallet signature only once.
const order = await client.submitOrder(prepared.order, signature);
// Retain order.id for history/reconciliation if tracking stops or times out.
const completed = await waitForOrder({ order, signal: input.signal });
return completed;`;

export function formatSpotSwapSdkFlow(data: JsonContainer = {}): string {
  const root = Array.isArray(data) ? {} : data;
  const chainId = typeof root.chainId === "number" ? root.chainId : 137;
  const partner = typeof root.partner === "string" && root.partner ? root.partner : "external";
  return `// spot-swap.ts — requires @orbs-network/spot-ui 2.1.21 or later.
import { createClient, getMinimumOutputAmount, isNativeAddress, isQuoteFresh, Partners, waitForOrder, type SpotClient, type SwapQuote } from "@orbs-network/spot-ui";
import { createPublicClient, createWalletClient, custom, erc20Abi, http, parseAbi, type Address, type EIP1193Provider, type Hash } from "viem";
import * as chains from "viem/chains";

const chainId = ${chainId};
const chain = Object.values(chains).find((value) => value.id === chainId);
if (!chain) throw new Error("Unsupported chain");
// Use the same partner for quoting and submission. Select your configured partner here.
const partner = ${JSON.stringify(partner)} as Partners;
const provider = (window as Window & { ethereum?: EIP1193Provider }).ethereum;
if (!provider) throw new Error("A browser wallet is required");
const publicClient = createPublicClient({ chain, transport: http() });
const walletClient = createWalletClient({ chain, transport: custom(provider) });
let clientPromise: Promise<SpotClient> | undefined;
function getClient() {
  clientPromise ??= createClient(partner, chainId).catch((error) => {
    clientPromise = undefined;
    throw error;
  });
  return clientPromise;
}
let busy = false;

export type SwapInput = {
  quote: SwapQuote;
  minimumOutputAmountRaw: string; // The exact minimum shown in host review.
  sourceToken: Address;
  wrappedNativeTokenAddress: Address; // Chain configuration, never taken from an untrusted quote.
  inputValueUsd: number; // Host product validation requires at least $10.
  signal?: AbortSignal; // Abort on unmount, account/chain change, or cancellation.
  pauseQuotes(): Promise<void>; // Pause polling and cancel in-flight quote requests.
  resumeQuotes(): void;
  // Hosts must ask for explicit review when a refreshed quote is worse.
  // Return the newly accepted minimum in raw units, or undefined to stop.
  reviewChangedQuote(previous: SwapQuote, next: SwapQuote): Promise<string | undefined>;
};

export async function swapFlow(account: Address, input: SwapInput) {
  if (busy) throw new Error("A swap is already being submitted");
  busy = true; // Retain the lock through settlement, including wallet prompts.
  try {
    await input.pauseQuotes();
    const client = await getClient();
    let quote = input.quote;
    let reviewedMinimum = input.minimumOutputAmountRaw;
    const request = quote.request;
    async function assertContext() {
      input.signal?.throwIfAborted();
      const [addresses, chainId] = await Promise.all([walletClient.getAddresses(), walletClient.getChainId()]);
      input.signal?.throwIfAborted();
      if (chainId !== request.chainId || addresses[0]?.toLowerCase() !== account.toLowerCase()) {
        throw new Error("Wallet changed. Review the swap again.");
      }
    }
    await assertContext();
    // Validate the signer, chain, partner, token pair, and reviewed minimum before wallet actions.
    client.prepareSwap({ quote, minimumOutputAmountRaw: reviewedMinimum, swapperAddress: account });
    const token = request.inToken as Address;
    const amount = BigInt(request.inAmount);
    const nativeInput = isNativeAddress(input.sourceToken);
    if ((nativeInput ? input.wrappedNativeTokenAddress : input.sourceToken).toLowerCase() !== token.toLowerCase()) {
      throw new Error("Quote input does not match the selected token or configured wrapped native token");
    }
    if (!Number.isFinite(input.inputValueUsd) || input.inputValueUsd < 10) throw new Error("Swap value must be at least $10");
    async function assertSpendBalance() {
      const balance = await publicClient.readContract({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [account] });
      await assertContext();
      if (balance < amount) throw new Error("Insufficient input token balance");
    }
    if (nativeInput) {
      const balance = await publicClient.getBalance({ address: account });
      if (balance < amount) throw new Error("Insufficient native input balance");
      await assertContext();
      await wrapNativeToken(token, amount, account);
      // A retry must select the wrapped token or explicitly reuse this confirmed deposit.
    }
    await assertContext();
    await approveTokenIfNeeded(token, account, client.spenderAddress, amount, input.signal);
    await assertSpendBalance();
    await assertContext();
    if (!isQuoteFresh(quote, 60_000)) {
      const next = await client.getQuote({ ...request, signal: input.signal });
      await assertContext();
      const worse = BigInt(next.netAmountOut) < BigInt(quote.netAmountOut)
        || BigInt(getMinimumOutputAmount(next.netAmountOut, request.slippage)) < BigInt(reviewedMinimum);
      if (worse) {
        const acceptedMinimum = await input.reviewChangedQuote(quote, next);
        if (!acceptedMinimum) throw new Error("Updated quote was not accepted");
        reviewedMinimum = acceptedMinimum;
      }
      await assertContext();
      quote = next;
      // A better quote preserves the original reviewed minimum.
      if (BigInt(quote.netAmountOut) < BigInt(reviewedMinimum)) throw new Error("Review the new minimum before retrying");
    }
    await assertSpendBalance();
    await assertContext();
${SWAP_SIGN_CODE.split("\n").map((line) => "    " + line).join("\n")}
    await assertSpendBalance();
    await assertContext();
    if (!isQuoteFresh(quote, 60_000)) throw new Error("Quote expired during signing. Review and sign again.");
${SWAP_SUBMIT_CODE.split("\n").map((line) => "    " + line).join("\n")}
  } finally {
    busy = false;
    input.resumeQuotes();
  }
}
${WALLET_CONFIRMATION_HELPERS}

${SWAP_ALLOWANCE_CODE}

${SWAP_WRAP_CODE}

${SWAP_APPROVAL_CODE}

// A failed submit response can leave acceptance uncertain. Reconcile order history before retrying.
`;
}

export const SPOT_SWAP_SDK_FLOW: CodeSnippetOptions = {
  copyLabel: "Copy code",
  fileName: "spot-swap.ts",
  format: formatSpotSwapSdkFlow,
  language: "TypeScript",
  syntaxLanguage: "typescript",
  hideStatusLabel: true,
};

export function formatSpotSwapSdkStep(step: "check" | "wrap" | "approve" | "sign" | "swap", data?: JsonContainer): string {
  const root = data && !Array.isArray(data) ? data : {};
  const sections = {
    check: `${SWAP_ALLOWANCE_CODE}\n\nconst approved = await hasEnoughAllowance(quote.request.inToken as Address, account, client.spenderAddress, BigInt(quote.request.inAmount));`,
    wrap: SWAP_WRAP_CODE,
    approve: `${SWAP_ALLOWANCE_CODE}\n\n${SWAP_APPROVAL_CODE}\n\nawait approveTokenIfNeeded(quote.request.inToken as Address, account, client.spenderAddress, BigInt(quote.request.inAmount), input.signal);`,
    sign: SWAP_SIGN_CODE,
    swap: `import { waitForOrder } from "@orbs-network/spot-ui";\n\n${root.demo ? "// Demo only: no wallet signature or order is submitted.\n" : ""}${SWAP_SUBMIT_CODE}`,
  };
  return `// From spot-swap.ts; uses the same client, reviewed quote, minimum, and wallet.\n${sections[step]}\n`;
}
