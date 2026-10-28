import { SPOT_SWAP_SDK_FLOW, formatSpotSwapSdkFlow, formatSpotSwapSdkStep } from "./sdk-flow-examples";
import type { CodeSnippetOptions, JsonContainer, JsonValue, JsonValuePath } from "../json-inspector";

const DEFAULT_CHAIN_ID = 137;
const DEFAULT_ACCOUNT = "0x5555555555555555555555555555555555555555";
const DEFAULT_INPUT_TOKEN = "0x1111111111111111111111111111111111111111";
const DEFAULT_OUTPUT_TOKEN = "0x6666666666666666666666666666666666666666";

function record(value: JsonValue | undefined): Record<string, JsonValue> {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export function formatSpotSwapSetupCode(data: JsonContainer = {}): string {
  const root = Array.isArray(data) ? {} : data;
  const chainId = typeof root.chainId === "number" ? root.chainId : DEFAULT_CHAIN_ID;
  const partner = typeof root.partner === "string" && root.partner ? root.partner : "external";
  return `import { createClient, Partners } from "@orbs-network/spot-ui";

// Reuse this client for the same chain and partner in quote and submission calls.
// Use your configured partner instead of External when applicable.
export const client = await createClient(${JSON.stringify(partner)} as Partners, ${chainId});
// client.spenderAddress is the ERC-20 allowance spender for this configuration.
`;
}

export function formatSpotSwapTypesCode(): string {
  return `export type { SwapQuote, SwapQuoteParams, PreparedSwap, OrderSigningRequest, Order } from "@orbs-network/spot-ui";
export type { Address, Hash } from "viem";`;
}

export function formatSpotSwapLiveQuoteCode(data: JsonContainer = {}): string {
  const root = Array.isArray(data) ? {} : data;
  const args = record(root.quoteArgs);
  const quoteArgs = Object.keys(args).length ? args : SPOT_SWAP_EXAMPLE_DATA.quoteArgs;
  return `${formatSpotSwapSetupCode(data)}

import type { ClientGetQuoteParams, SwapQuote } from "@orbs-network/spot-ui";
const quoteArgs = ${JSON.stringify(quoteArgs, null, 2)} satisfies ClientGetQuoteParams;

export async function getSpotSwapQuote(signal?: AbortSignal): Promise<SwapQuote> {
  // Use the wrapped ERC-20 input address for native input. This is a read only request.
  // Refetch for the connected signer after connecting or switching accounts.
  return client.getQuote({ ...quoteArgs, signal });
}
`;
}

export const formatSpotSwapGetLatestQuoteCode = formatSpotSwapLiveQuoteCode;
export const formatSpotSwapQuoteCode = formatSpotSwapSdkFlow;
export const formatSpotSwapFullFlowCode = formatSpotSwapSdkFlow;
export const formatSpotSwapSignCode = () => formatSpotSwapSdkStep("sign");
export const formatSpotSwapWrapCode = () => formatSpotSwapSdkStep("wrap");
export const formatSpotSwapApprovalCode = () => formatSpotSwapSdkStep("approve");
export const formatSpotSwapAllowanceCode = () => formatSpotSwapSdkStep("check");
export const formatSpotSwapSwapAndConfirmCode = () => formatSpotSwapSdkStep("swap");
export const formatSpotSwapSwapCode = formatSpotSwapSwapAndConfirmCode;
export function formatSpotSwapCurrentQuoteCode(data: JsonContainer): string {
  const root = Array.isArray(data) ? {} : data;
  return `import type { SwapQuote } from "@orbs-network/spot-ui";\n\nconst quote = ${JSON.stringify(root.quote ?? root, null, 2)} satisfies SwapQuote;`;
}

function stepSnippet(step: "check" | "wrap" | "approve" | "sign" | "swap"): CodeSnippetOptions {
  return {
    copyLabel: "Copy code",
    fileName: `${step}.ts`,
    format: (data) => formatSpotSwapSdkStep(step, data),
    language: "TypeScript",
    syntaxLanguage: "typescript",
  };
}

export const SPOT_SWAP_SETUP_CODE_SNIPPET: CodeSnippetOptions = {
  copyLabel: "Copy code", fileName: "spot-swap.ts", format: formatSpotSwapSetupCode,
  language: "TypeScript", syntaxLanguage: "typescript",
};
export const SPOT_SWAP_QUOTE_CODE_SNIPPET = SPOT_SWAP_SDK_FLOW;
export const SPOT_SWAP_FULL_FLOW_CODE_SNIPPET = SPOT_SWAP_SDK_FLOW;
export const SPOT_SWAP_LIVE_QUOTE_CODE_SNIPPET: CodeSnippetOptions = {
  copyLabel: "Copy code", fileName: "quote.ts", format: formatSpotSwapLiveQuoteCode,
  files: [{ name: "types.ts", format: formatSpotSwapTypesCode, syntaxLanguage: "typescript", showFieldTooltips: false }],
  language: "TypeScript", syntaxLanguage: "typescript",
};
export const SPOT_SWAP_WRAP_CODE_SNIPPET = stepSnippet("wrap");
export const SPOT_SWAP_APPROVAL_CODE_SNIPPET = stepSnippet("approve");
export const SPOT_SWAP_ALLOWANCE_CODE_SNIPPET = stepSnippet("check");
export const SPOT_SWAP_SIGN_CODE_SNIPPET = stepSnippet("sign");
export const SPOT_SWAP_SWAP_AND_CONFIRM_CODE_SNIPPET = stepSnippet("swap");
export const SPOT_SWAP_SWAP_CODE_SNIPPET = SPOT_SWAP_SWAP_AND_CONFIRM_CODE_SNIPPET;

const FIELD_EXPLANATIONS: Record<string, string> = {
  partner: "The Spot partner used to initialize this client. Quotes and submitted orders must use the same partner.",
  chainId: "The EVM chain used for the quote, configured spender, wallet operations, and order settlement.",
  inputIsNative: "Native input is quoted using its wrapped ERC-20 address and deposited before allowance and signing.",
  quoteArgs: "Inputs passed to client.getQuote. This request does not open a wallet or prepare an order.",
  request: "Frozen request identity retained with this quote. It is not a signing payload.",
  inToken: "ERC-20 input address. Pass the wrapped native token address for native input.",
  outToken: "The token received by the signer when this exact input swap fills.",
  inAmount: "Exact input amount as an integer in input token base units.",
  user: "The account that will sign and receive the output. Preview accounts must be requoted after connection.",
  slippage: "UI slippage percentage: 0.5 means 0.5%. It is separate from the signed order's fixed SWAP protection.",
  dexMinAmountOut: "DEX minimum in output token base units, or -1 when no DEX quote is available.",
  receivedAt: "Local quote receipt time in Unix milliseconds. Use isQuoteFresh(quote, 60_000) before signing and submission.",
  amountOut: "Raw output amount returned by the quote service.",
  netAmountOut: "Net output amount used for display and deriving the host's reviewed minimum.",
  minimumAmountOut: "Service minimum. The host uses getMinimumOutputAmount(netAmountOut, UI slippage) for its review.",
  feeAmount: "Service fee amount in output token base units.",
  minimumOutputAmountRaw: "The exact host reviewed minimum passed unchanged to client.prepareSwap.",
  prepared: "Locally prepared swap order, approval request, and original wallet signing payload.",
  signingRequest: "Original SDK signer and typed data. Sign unchanged and keep its order paired with the original signature.",
  approvalRequest: "Input token, raw input amount, and configured RePermit spender requiring allowance.",
  spenderAddress: "The spender supplied by this client's configuration. Do not substitute a hardcoded contract.",
  execution: "The local signature and accepted or completed order for this developer flow.",
  order: "The order accepted by submitOrder. Acceptance is followed by waitForOrder to confirm a completed fill.",
  id: "Full signed order ID for settlement lookup and history reconciliation. This is not a transaction hash.",
  signature: "Original wallet signature over the prepared signing request. Submit it unchanged with the exact prepared order.",
  status: "Order lifecycle status. Only a completed fill is reported as swap success.",
  fills: "Confirmed on-chain fills with their actual transaction hashes and input/output amounts.",
};

export function getSpotSwapFieldExplanation(path: JsonValuePath): string | undefined {
  const segments = path.filter((value) => typeof value !== "number");
  const normalized = segments.filter((segment) => !["quote", "quoteArgs", "request"].includes(String(segment))).join(".");
  return FIELD_EXPLANATIONS[normalized] ?? FIELD_EXPLANATIONS[String(segments.at(-1))];
}

export const SPOT_SWAP_EXAMPLE_DATA = {
  partner: "external", chainId: DEFAULT_CHAIN_ID, inputIsNative: false,
  quoteArgs: {
    inToken: DEFAULT_INPUT_TOKEN, outToken: DEFAULT_OUTPUT_TOKEN,
    inAmount: "1000000000000000000", dexMinAmountOut: "-1", slippage: 0.5, user: DEFAULT_ACCOUNT,
  },
} satisfies JsonContainer;

export const SPOT_SWAP_QUOTE_EXAMPLE_RESPONSE_DATA = {
  request: { ...SPOT_SWAP_EXAMPLE_DATA.quoteArgs, chainId: DEFAULT_CHAIN_ID, partner: "external" },
  receivedAt: 1792972800000,
  amountOut: "2500000000", netAmountOut: "2495000000", minimumAmountOut: "2482525000", feeAmount: "5000000",
} satisfies JsonContainer;
