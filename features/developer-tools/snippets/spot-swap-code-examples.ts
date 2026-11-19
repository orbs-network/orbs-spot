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
  const clientOptions = typeof root.apiUrl === "string" ? `, { apiUrl: ${JSON.stringify(root.apiUrl)} }` : "";
  return `import { createClient, Partners } from "@orbs-network/spot-ui";

// Reuse this client for the same chain and partner in quote and submission calls.
// Use your configured partner instead of External when applicable.
export const client = await createClient(${JSON.stringify(partner)} as Partners, ${chainId}${clientOptions});
// Configuration and quotes always use production v2; apiUrl selects the order backend.
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
  const quoteArgs: Record<string, JsonValue> = Object.keys(args).length ? args : SPOT_SWAP_EXAMPLE_DATA.quoteArgs;
  const policy = record(root.slippagePolicy);
  const outputTarget = typeof quoteArgs.outAmount === "string";
  const slippagePolicy = {
    mode: policy.mode === "custom" ? "custom" : "auto",
    baseline: typeof policy.baseline === "number" ? policy.baseline
      : typeof quoteArgs.slippage === "number" ? quoteArgs.slippage : 0.5,
    tokenAddress: typeof policy.tokenAddress === "string" ? policy.tokenAddress
      : outputTarget ? quoteArgs.outToken : quoteArgs.inToken,
    tokenDecimals: typeof policy.tokenDecimals === "number" ? policy.tokenDecimals : 18,
    rawAmount: typeof policy.rawAmount === "string" ? policy.rawAmount
      : outputTarget ? quoteArgs.outAmount : quoteArgs.inAmount,
  };
  return `${formatSpotSwapSetupCode(data)}

import BN from "bignumber.js";
import { getSwapSlippage, getTokenUsd, type ClientGetQuoteParams, type SwapQuote } from "@orbs-network/spot-ui";
const quoteArgs = ${JSON.stringify(quoteArgs, null, 2)} satisfies ClientGetQuoteParams;
// Use the typed side's token, raw amount, and registry decimals for automatic policy.
const slippagePolicy: {
  mode: "auto" | "custom";
  baseline: number;
  tokenAddress: string;
  tokenDecimals: number;
  rawAmount: string;
} = ${JSON.stringify(slippagePolicy, null, 2)};

async function resolveSlippage(signal?: AbortSignal): Promise<number> {
  signal?.throwIfAborted();
  if (slippagePolicy.mode === "custom") return slippagePolicy.baseline;

  // Host apps can start token-price queries on selection, before typing or client setup.
  // Cache by chainId and lowercase token address for 30 seconds, then reuse that
  // fresh or in-flight result for quoting. This standalone example makes a fresh
  // price request each time; the SDK does not cache or share price requests.
  let amountUsd: string | undefined;
  if (new BN(slippagePolicy.rawAmount).gt(0)) {
    const waitController = new AbortController();
    const waitSignal = signal
      ? AbortSignal.any([signal, waitController.signal]) : waitController.signal;
    const timeout = setTimeout(() => waitController.abort(), 1_500);
    try {
      const unitPriceUsd = await getTokenUsd({
        tokenAddress: slippagePolicy.tokenAddress, chainId: client.chainId,
        signal: waitSignal,
      });
      amountUsd = new BN(slippagePolicy.rawAmount)
        .shiftedBy(-slippagePolicy.tokenDecimals).times(unitPriceUsd).toFixed();
    } catch {
      signal?.throwIfAborted(); // Price failure/timeout falls back; caller cancellation stops quoting.
    } finally {
      clearTimeout(timeout);
      waitController.abort(); // Cancels this request if it is still in progress.
    }
  }
  signal?.throwIfAborted();
  return getSwapSlippage({ amountUsd, slippage: slippagePolicy.baseline || 0.5 }).slippagePercent;
}

export async function getSpotSwapQuote(signal?: AbortSignal): Promise<SwapQuote> {
  // Use the wrapped ERC-20 input address for native input. This is a read only request.
  // A disconnected preview can use the host's preview address. Pass the actual
  // connected account to await client.prepareSwap({ quote, account, signal }).
  // Supply exactly one amount: inAmount for spending or outAmount for a receive
  // target. Keep the token pair unchanged; request.inAmount resolves the spend.
  const slippage = await resolveSlippage(signal);
  // Display quote.request.slippage after quoting and preserve it through review.
  return client.getQuote({ ...quoteArgs, slippage, signal });
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
  apiUrl: "Selected order backend for submission, status, history, and recovery. Configuration and client.getQuote always use production v2.",
  quoteApiUrl: "Production v2 service used by client.getQuote, independently of the selected order backend.",
  inputIsNative: "Native input is quoted using its wrapped ERC-20 address and deposited before allowance and signing.",
  quoteArgs: "Inputs passed to client.getQuote. This request does not open a wallet or prepare an order.",
  slippagePolicy: "Host policy resolved before quoting. Automatic mode prices the typed side and calls getSwapSlippage; custom mode uses the chosen percentage directly.",
  mode: "Automatic mode applies the SDK's USD-based slippage policy. Custom mode skips pricing and the automatic helper.",
  baseline: "Positive DEX slippage percentage used as the automatic baseline, or the unchanged user-selected custom percentage.",
  tokenAddress: "The typed side's token address for the USD unit-price lookup. Native input uses its configured wrapped token.",
  tokenDecimals: "Registry decimals for the typed token. Convert rawAmount with these decimals before multiplying by USD per whole token.",
  rawAmount: "Typed amount in token base units. Input entry uses input-token units; receive entry uses output-token units.",
  amountUsd: "Full-precision total USD value used by automatic slippage, calculated from raw amount, token decimals, and the SDK unit price. Missing pricing retains the baseline.",
  slippagePercent: "Resolved percentage passed to the quote. Automatic trades worth $100 or less use at least 1%; larger or unpriced amounts retain the baseline.",
  request: "Frozen executable input identity retained with this quote. For an output target, inAmount is the server-resolved spend. It is not a signing payload.",
  inToken: "ERC-20 input address. Pass the wrapped native token address for native input.",
  outToken: "The token received by the signer when the swap fills. Keep the actual pair unchanged for output targets.",
  inAmount: "Exact spend as an integer in input-token base units. In quote.request, this is the resolved input even when the request used outAmount.",
  outAmount: "Output-token amount in integer base units. In quoteArgs this is the requested receive target, supplied instead of inAmount so the server calculates the input.",
  requestedOutAmount: "Original output-token target for an outAmount quote. The frozen request.inAmount is its executable spend, and the protected minimum covers the target.",
  user: "The account sent to the quote service, including a preview address before connection. It does not determine the signer.",
  userAddress: "The connected account passed to await client.prepareSwap({ quote, account, signal }). It signs the order and receives the output.",
  slippage: "Reviewed swap slippage percentage: 0.5 means 0.5%. Preparation converts this to 50 basis points in witness.slippage and preserves the quoted minimum unchanged.",
  dexMinAmountOut: "Optional local competing minimum for input quotes. It is not sent to the service; omit it for output-target requests.",
  receivedAt: "Local quote receipt time in Unix milliseconds. Use isQuoteFresh(quote, 20_000) before signing and submission.",
  amountOut: "Raw output amount returned by the quote service.",
  netAmountOut: "Net output amount used for display.",
  minimumAmountOut: "Service-provided minimum shown unchanged in review and signed by client.prepareSwap.",
  feeAmount: "Service fee amount in output token base units.",
  minimumOutputAmountRaw: "The prepared minimum copied unchanged from quote.minimumAmountOut.",
  deadlineMillis: "Swap expiration as a Unix timestamp in milliseconds, three minutes after preparation.",
  prepared: "Prepared swap order, selected quote, approval request, and original wallet signing payload. Stale quotes can refresh during preparation.",
  signingRequest: "Original SDK signer and typed data. Sign unchanged and keep its order paired with the original signature.",
  approvalRequest: "Input token, raw input amount, and configured RePermit spender requiring allowance.",
  spenderAddress: "The spender supplied by this client's configuration. Do not substitute a hardcoded contract.",
  execution: "The local signature and accepted or completed order for this developer flow.",
  order: "The order accepted by submitSwap. Host polling through client.getOrder confirms a completed fill.",
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
  slippagePolicy: {
    mode: "auto", baseline: 0.5, tokenAddress: DEFAULT_INPUT_TOKEN,
    tokenDecimals: 18, rawAmount: "1000000000000000000",
  },
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
