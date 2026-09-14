import type { CodeSnippetOptions, JsonContainer } from "./json-inspector";
import { getLiquidityHubExamplePartnerId } from "./developer-partner";
import { getOrderFormFieldExplanation } from "./order-form-field-explanations";

const WALLET_IMPORTS = `import { createPublicClient, createWalletClient, custom, erc20Abi, http, parseAbi, type Address, type EIP1193Provider, type Hash } from "viem";`;

const TRANSACTION_CONFIRMATION_CODE = `async function waitForTransactionConfirmation(hash: Hash) {
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Transaction reverted");
  return receipt;
}`;

const WALLET_CONFIRMATION_HELPERS = `
const wrappedNativeAbi = parseAbi(["function deposit() payable"]);

${TRANSACTION_CONFIRMATION_CODE}`;

const LH_WRAP_CODE = `const hash = await walletClient.writeContract({
  address: token, abi: wrappedNativeAbi, functionName: "deposit",
  value: amount, account, chain: walletClient.chain,
});
await waitForTransactionConfirmation(hash);`;

const LH_ALLOWANCE_CODE = `async function hasEnoughAllowance(token: Address, account: Address, spender: Address, amount: bigint): Promise<boolean> {
  const allowance = await publicClient.readContract({
    address: token,
    abi: erc20Abi,
    functionName: "allowance",
    args: [account, spender],
  });
  return allowance >= amount;
}`;

const LH_ALLOWANCE_CHECK = `if (await hasEnoughAllowance(token, account, spender, amount)) return;`;

const LH_APPROVAL_CODE = `const hash = await walletClient.writeContract({
  address: token, abi: erc20Abi, functionName: "approve",
  args: [spender, amount], account, chain: walletClient.chain,
});
await waitForTransactionConfirmation(hash);
for (let attempt = 0; attempt < 3; attempt += 1) {
  if (await hasEnoughAllowance(token, account, spender, amount)) return;
  await new Promise((resolve) => setTimeout(resolve, 1_000));
}
throw new Error("Approval is not yet available; check allowance before retrying");`;

const LH_SIGN_CODE = `async function signQuote(quote: Quote, account: Address, refetchQuote: () => Promise<Quote>) {
  // Wallet transactions take time; refresh a stale quote before signing.
  if (!isFreshQuote(quote, 60)) {
    const freshQuote = await refetchQuote();
    if (BigInt(freshQuote.minAmountOut) < BigInt(quote.minAmountOut)) {
      throw new Error("The price has changed. Please approve the new price before signing.");
    }
    quote = freshQuote;
  }
  const signature = await walletClient.signTypedData({
    domain: quote.eip712.domain,
    types: quote.eip712.types,
    primaryType: quote.eip712.primaryType,
    message: quote.eip712.message,
    account,
  });
  return { quote, signature };
}`;

const LH_SUBMIT_CODE = `async function swapAndConfirm(quote: Quote, signature: Hash) {
  // Submit the exact quote used to create the signature.
  const hash = await client.swap(quote, signature) as Hash;
  const receipt = await waitForTransactionConfirmation(hash);
  return { hash, receipt };
}`;

const LH_APPROVE_FUNCTION = `async function approveTokenIfNeeded(
  account: Address,
  token: Address,
  spender: Address,
  amount: bigint,
) {
${LH_ALLOWANCE_CHECK.split("\n").map((line) => "  " + line).join("\n")}

${LH_APPROVAL_CODE.split("\n").map((line) => "  " + line).join("\n")}
}`;

const WALLET_HELPERS = `${WALLET_CONFIRMATION_HELPERS}

async function wrapNativeToken(
  account: Address,
  token: Address,
  amount: bigint,
) {
${LH_WRAP_CODE.split("\n").map((line) => "  " + line).join("\n")}
}

${LH_APPROVE_FUNCTION}

${LH_ALLOWANCE_CODE}`;

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
  message: message.message,
  account: signerAddress,
});`;

const ADVANCED_SUBMIT_CODE = `// Submit exactly this prepared order with its unchanged signature, once.
return await client.submitOrder(prepared, signature);`;

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
  return `// advanced-orders.ts — requires @orbs-network/spot-ui 2.1.2 or later.
import { calculateOrderForm, createClient, isNativeAddress, Module, Partners } from "@orbs-network/spot-ui";
import { createPublicClient, createWalletClient, custom, erc20Abi, http, parseAbi, type Address, type EIP1193Provider, type Hash } from "viem";
import { polygon } from "viem/chains";

// Browser example: use the chain selected in the host wallet.
const chain = polygon;
const partner = Partners.Unknown;
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
  const form = calculateOrderForm(${calculationInput.split("\n").join("\n  ")});
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

export function formatLiquidityHubSdkFlow(data: JsonContainer): string {
  const chainId = !Array.isArray(data) && typeof data.chainId === "number"
    ? data.chainId
    : 137;
  const partner = getLiquidityHubExamplePartnerId(
    Array.isArray(data) ? undefined : data.partner,
  );
  return `// liquidity-hub.ts
import { createClient, isFreshQuote, nativeTokenAddresses, permit2Address, type Quote } from "@orbs-network/liquidity-hub-sdk";
${WALLET_IMPORTS}
import * as chains from "viem/chains";

const chainId = ${JSON.stringify(chainId)};
const partner = ${JSON.stringify(partner)};
const chain = Object.values(chains).find((chain) => chain.id === chainId);
const provider = (window as Window & { ethereum?: EIP1193Provider }).ethereum!;
const publicClient = createPublicClient({ chain, transport: http() });
const walletClient = createWalletClient({ chain, transport: custom(provider) });
const client = createClient({ chainId, partner });

export type SwapInput = {
  quote: Quote; // The wallet-bound quote selected and reviewed by the host.
  refetchQuote: () => Promise<Quote>;
  sourceToken: Address;
  wrappedNativeToken: Address;
};

export async function swapFlow(account: Address, input: SwapInput) {
  const initialQuote = input.quote;
  const sourceIsNative = isNativeToken(input.sourceToken);
  const token = sourceIsNative ? input.wrappedNativeToken : input.sourceToken;

  const amount = BigInt(initialQuote.inAmount);
  if (sourceIsNative) {
    await wrapNativeToken(account, token, amount);
  }
  await approveTokenIfNeeded(account, token,
    permit2Address as Address, amount);

  const { quote, signature } = await signQuote(initialQuote, account, input.refetchQuote);

  return swapAndConfirm(quote, signature);
}
${WALLET_HELPERS}

${LH_SIGN_CODE}

${LH_SUBMIT_CODE}

function isNativeToken(token: Address): boolean {
  return nativeTokenAddresses.some(
    (address) => address.toLowerCase() === token.toLowerCase(),
  );
}

// Host usage: const result = await swapFlow(account, { ...selectedSwapInput, refetchQuote });

/*
Swap steps

1. Wrap native input into its wrapped ERC-20 token. Skip this for ERC-20 input.
   Wait for the deposit to confirm before continuing.
2. Check the Permit2 allowance and approve only when it is below the input amount.
   Wait for approval confirmation and check that the allowance is available.
3. Check quote freshness after wrapping and approval. Wallet prompts and transaction
   confirmations take time, so the original quote may have become stale meanwhile.
   If it is 60 seconds old or older, call refetchQuote() before signing. The callback
   should return a new quote for the same account, token pair, amount, and slippage.
   Refetching can change the price and minimum output; the host should handle review
   of changed terms before returning the replacement quote.
4. Sign the current quote's EIP-712 data. Refresh before signing because the signature
   authorizes that specific quote; a replacement quote needs a new signature.
5. Submit the exact signed quote and signature to Liquidity Hub. The returned hash
   identifies the transaction; wait for a successful receipt to confirm completion.
*/
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

export const LIQUIDITY_HUB_SDK_FLOW: CodeSnippetOptions = {
  copyLabel: "Copy code",
  fileName: "liquidity-hub.ts",
  format: formatLiquidityHubSdkFlow,
  language: "TypeScript",
  syntaxLanguage: "typescript",
  hideStatusLabel: true,
};

export type AdvancedOrdersSdkStep = "check" | "wrap" | "approve" | "sign" | "submit";

export function formatAdvancedOrdersSdkStep(step: AdvancedOrdersSdkStep, data?: JsonContainer): string {
  const orderMessage = data && !Array.isArray(data) ? data.message : undefined;
  const signCode = orderMessage && typeof orderMessage === "object"
    ? ADVANCED_SIGN_CODE.replace(
        "  message: message.message,",
        `  // message: message.message,
  message: ${JSON.stringify(orderMessage, null, 2).split("\n").join("\n  ")},`,
      )
    : ADVANCED_SIGN_CODE;
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
    submit: ADVANCED_SUBMIT_CODE,
  };
  return `// From advanced-orders.ts; uses the same clients and order values.
${sections[step]}
`;
}

export function formatLiquidityHubSdkStep(step: "check" | "wrap" | "approve" | "sign" | "swap", data?: JsonContainer): string {
  const message = data && !Array.isArray(data) ? data.message : undefined;
  const signCode = message && typeof message === "object" && !Array.isArray(message)
    ? LH_SIGN_CODE.replace(
        "    message: quote.eip712.message,",
        `    // message: quote.eip712.message,
    message: ${JSON.stringify(message, null, 2).split("\n").join("\n    ")},`,
      )
    : LH_SIGN_CODE;
  const sections = {
    check: `${LH_APPROVE_FUNCTION}

${LH_ALLOWANCE_CODE}`,
    wrap: LH_WRAP_CODE,
    approve: `${LH_ALLOWANCE_CHECK}

${LH_APPROVAL_CODE}`,
    sign: `import { createWalletClient, custom, type Address, type EIP1193Provider, type Hash } from "viem";
import { isFreshQuote, type Quote } from "@orbs-network/liquidity-hub-sdk";

const provider = (window as Window & { ethereum?: EIP1193Provider }).ethereum!;
const walletClient = createWalletClient({ transport: custom(provider) });

${signCode}`,
    swap: `import { createPublicClient, http, type Hash } from "viem";
import type { Quote } from "@orbs-network/liquidity-hub-sdk";

const publicClient = createPublicClient({ chain, transport: http() });

${LH_SUBMIT_CODE}

${TRANSACTION_CONFIRMATION_CODE}`,
  };
  return `// From liquidity-hub.ts; uses the same clients, SDK, and quote.
${sections[step]}
`;
}
