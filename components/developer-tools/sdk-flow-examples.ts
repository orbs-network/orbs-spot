import type { CodeSnippetOptions, JsonContainer } from "./json-inspector";
import { getLiquidityHubExamplePartnerId } from "./developer-partner";
import { getOrderFormFieldExplanation } from "./order-form-field-explanations";

const WALLET_IMPORTS = `import { erc20Abi, parseAbi, type Address, type Hash, type PublicClient, type WalletClient } from "viem";`;

const WALLET_CONFIRMATION_HELPERS = `
const wrappedNativeAbi = parseAbi(["function deposit() payable"]);

async function waitForTransactionConfirmation(publicClient: PublicClient, hash: Hash) {
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Transaction reverted");
  return receipt;
}`;

const LH_WRAP_CODE = `if (sourceIsNative) {
  const hash = await walletClient.writeContract({
    address: token, abi: wrappedNativeAbi, functionName: "deposit",
    value: amount, account, chain: walletClient.chain,
  });
  await waitForTransactionConfirmation(publicClient, hash);
}`;

const LH_ALLOWANCE_CODE = `const readAllowance = () => publicClient.readContract({
  address: token, abi: erc20Abi, functionName: "allowance",
  args: [account, spender],
});
if (await readAllowance() >= amount) return;`;

const LH_APPROVAL_CODE = `const hash = await walletClient.writeContract({
  address: token, abi: erc20Abi, functionName: "approve",
  args: [spender, amount], account, chain: walletClient.chain,
});
await waitForTransactionConfirmation(publicClient, hash);
for (let attempt = 0; attempt < 3; attempt += 1) {
  if (await readAllowance() >= amount) return;
  await new Promise((resolve) => setTimeout(resolve, 1_000));
}
throw new Error("Approval is not yet available; check allowance before retrying");`;

const LH_SIGN_CODE = `// Refresh after wallet transactions; never silently accept a worse quote.
if (!isFreshQuote(quote, 60)) {
  const fresh = await sdk.getQuote({
    fromToken: quote.inToken, toToken: quote.outToken,
    inAmount: quote.inAmount, account, slippage: quote.slippage,
    dexMinAmountOut: "-1",
  });
  if (!isFreshQuote(fresh, 60) || fresh.user.toLowerCase() !== account.toLowerCase() ||
      fresh.inToken.toLowerCase() !== quote.inToken.toLowerCase() ||
      fresh.outToken.toLowerCase() !== quote.outToken.toLowerCase() ||
      fresh.inAmount !== quote.inAmount ||
      BigInt(fresh.minAmountOut) < BigInt(quote.minAmountOut)) {
    throw new Error("Quote changed; review a new quote before continuing");
  }
  quote = fresh;
}

sdk.analytics.signature.onRequest();
let signature: Hash;
try {
  signature = await walletClient.signTypedData({ ...quote.eip712, account });
  sdk.analytics.signature.onSuccess(signature);
} catch (error) {
  sdk.analytics.signature.onFailed(String(error));
  throw error;
}`;

const LH_SUBMIT_CODE = `try {
  // Pass the exact signed quote to the SDK; do not reconstruct its payload.
  const hash = await sdk.swap(quote, signature) as Hash;
  const receipt = await waitForTransactionConfirmation(publicClient, hash);
  const details = await sdk.getTransactionDetails(hash, quote);
  sdk.analytics.swap.onSuccess();
  return { hash, receipt, details };
} catch (error) {
  sdk.analytics.swap.onFailed(String(error));
  throw error;
}`;

const WALLET_HELPERS = `${WALLET_CONFIRMATION_HELPERS}

async function prepareInput(
  publicClient: PublicClient,
  walletClient: WalletClient,
  account: Address,
  token: Address,
  spender: Address,
  amount: bigint,
  sourceIsNative: boolean,
) {
${LH_WRAP_CODE.split("\n").map((line) => "  " + line).join("\n")}

${LH_ALLOWANCE_CODE.split("\n").map((line) => "  " + line).join("\n")}

${LH_APPROVAL_CODE.split("\n").map((line) => "  " + line).join("\n")}
}`;

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
  await waitForTransactionConfirmation(publicClient, hash);
}`;

const ADVANCED_APPROVAL_CODE = `async function approveToken(inputToken: Address, spender: Address, amount: bigint, account: Address) {
  let allowance = await readAllowance(inputToken, account, spender);
  if (allowance < amount) {
    const hash = await walletClient.writeContract({
      address: inputToken, abi: erc20Abi, functionName: "approve",
      args: [spender, amount], account, chain: walletClient.chain,
    });
    await waitForTransactionConfirmation(publicClient, hash);
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

function getClient(chainId: number) {
  clientPromise ??= createClient(partner, chainId).catch((error) => {
    clientPromise = undefined;
    throw error;
  });
  return clientPromise;
}`;

export function formatAdvancedOrdersSdkFlow(): string {
  return `// advanced-orders.ts — requires @orbs-network/spot-ui 2.1.2 or later.
import { calculateOrderForm, createClient, isNativeAddress, Partners } from "@orbs-network/spot-ui";
import { createPublicClient, createWalletClient, custom, erc20Abi, http, parseAbi, type Address, type EIP1193Provider, type Hash, type PublicClient } from "viem";
import { polygon } from "viem/chains";
import { getOrderForm } from "./calculate-order-form";

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
  const chainId = walletClient.chain?.id;
  if (!chainId || await walletClient.getChainId() !== chainId ||
      await publicClient.getChainId() !== chainId) {
    throw new Error("Connect the wallet and RPC to the same chain");
  }
  const form = calculateOrderForm(getOrderForm().formParams);
  if (!form.canSubmit) throw new Error("Resolve the order form errors first");

  const client = await getClient(chainId);
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
  const partner = getLiquidityHubExamplePartnerId(
    Array.isArray(data) ? undefined : data.partner,
  );
  return `// liquidity-hub.ts
import { constructSDK, isFreshQuote, nativeTokenAddresses, permit2Address, type Quote } from "@orbs-network/liquidity-hub-sdk";
${WALLET_IMPORTS}

export type SwapInput = {
  quote: Quote; // The wallet-bound quote selected and reviewed by the host.
  sourceToken: Address;
  wrappedNativeToken: Address;
  setPollingPaused: (paused: boolean) => void;
};

// Create once per connected chain and wallet.
export function createLiquidityHubFlow(
  publicClient: PublicClient,
  walletClient: WalletClient,
  partner = ${JSON.stringify(partner)}, // Use the partner name supplied by Orbs.
) {
  const chainId = walletClient.chain?.id;
  if (!chainId) throw new Error("Connect a wallet first");
  const sdk = constructSDK({ chainId, partner });
  let pending = false;

  return async (account: Address, input: SwapInput) => {
    if (pending) throw new Error("A swap is already in progress");
    pending = true;
    try {
      input.setPollingPaused(true);
      if (await walletClient.getChainId() !== chainId ||
          await publicClient.getChainId() !== chainId) {
        throw new Error("Connect the wallet and RPC to the same chain");
      }
      let quote = structuredClone(input.quote);
      const sourceIsNative = nativeTokenAddresses.some(
        (address) => address.toLowerCase() === input.sourceToken.toLowerCase(),
      );
      const token = sourceIsNative ? input.wrappedNativeToken : input.sourceToken;
      if (quote.user.toLowerCase() !== account.toLowerCase() ||
          quote.inToken.toLowerCase() !== token.toLowerCase()) {
        throw new Error("Request a quote for the current account and input token");
      }

      await prepareInput(publicClient, walletClient, account, token,
        permit2Address as Address, BigInt(quote.inAmount), sourceIsNative);

${LH_SIGN_CODE.split("\n").map((line) => "      " + line).join("\n")}

${LH_SUBMIT_CODE.split("\n").map((line) => "      " + line).join("\n")}
    } finally {
      pending = false;
      input.setPollingPaused(false);
    }
  };
}
${WALLET_HELPERS}

// Host usage: const swap = createLiquidityHubFlow(publicClient, walletClient);
// const result = await swap(account, selectedSwapInput);
`;
}

export function formatOrderFormCalculation(data: JsonContainer): string {
  const params = Array.isArray(data) ? {} : data.formParams ?? {};
  const serialized = JSON.stringify({ formParams: params }, null, 2)
    .replace(/"module": "(TWAP|LIMIT|STOP_LOSS|TAKE_PROFIT)"/, '"module": Module.$1');
  return `import { Module } from "@orbs-network/spot-ui";

// Edit these inputs, then save to recalculate the live order's RePermit data.
export function getOrderForm() {
  return ${serialized.split("\n").join("\n  ")};
}
`;
}

export const ADVANCED_ORDERS_SDK_FLOW: CodeSnippetOptions = {
  copyLabel: "Copy code",
  fileName: "advanced-orders.ts",
  format: formatAdvancedOrdersSdkFlow,
  getFieldExplanation: getOrderFormFieldExplanation,
  files: [{ name: "calculate-order-form.ts", format: formatOrderFormCalculation, syntaxLanguage: "typescript", inlineEditable: true }],
  language: "TypeScript",
  syntaxLanguage: "typescript",
  hideStatusLabel: true,
};

export const LIQUIDITY_HUB_SDK_FLOW: CodeSnippetOptions = {
  copyLabel: "Copy code",
  fileName: "TypeScript",
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
  const client = await getClient(chain.id);
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

export function formatLiquidityHubSdkStep(step: "check" | "wrap" | "approve" | "sign" | "swap"): string {
  const sections = {
    check: LH_ALLOWANCE_CODE,
    wrap: LH_WRAP_CODE,
    approve: `${LH_ALLOWANCE_CODE}

${LH_APPROVAL_CODE}`,
    sign: LH_SIGN_CODE,
    swap: LH_SUBMIT_CODE,
  };
  return `// From liquidity-hub.ts; uses the same clients, SDK, and quote.
${sections[step]}
`;
}
