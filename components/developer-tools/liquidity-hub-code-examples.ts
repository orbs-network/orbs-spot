import { LIQUIDITY_HUB_SDK_FLOW, formatLiquidityHubSdkFlow, formatLiquidityHubSdkStep } from "./sdk-flow-examples";
import type {
  CodeSnippetFileOptions,
  CodeSnippetOptions,
  JsonContainer,
  JsonValue,
  JsonValuePath,
} from "./json-inspector";
import {
  formatLiquidityHubPartnerDeclaration,
  getLiquidityHubExamplePartnerId,
} from "./developer-partner";

const DEFAULT_CHAIN_ID = 137;
const DEFAULT_ACCOUNT = "0x5555555555555555555555555555555555555555";
const DEFAULT_INPUT_TOKEN = "0x1111111111111111111111111111111111111111";
const DEFAULT_OUTPUT_TOKEN = "0x6666666666666666666666666666666666666666";

function getRecord(value: JsonValue | undefined): Record<string, JsonValue> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

function getString(value: JsonValue | undefined, fallback: string): string {
  return typeof value === "string" && value ? value : fallback;
}

function getExampleParams(data: JsonContainer) {
  const root = Array.isArray(data) ? {} : data;
  const quoteArgs = getRecord(root.quoteArgs);
  const chainId =
    typeof root.chainId === "number" ? root.chainId : DEFAULT_CHAIN_ID;
  const partner = getLiquidityHubExamplePartnerId(root.partner);
  const inputIsNative = root.inputIsNative === true;

  return { chainId, inputIsNative, partner, quoteArgs };
}

function formatTypeScriptObject(value: Record<string, JsonValue>): string {
  return JSON.stringify(value, null, 2).replace(
    /^(\s*)"([A-Za-z_$][\w$]*)":/gm,
    "$1$2:",
  );
}

function formatJsonObject(value: Record<string, JsonValue>): string {
  return JSON.stringify(value, null, 2);
}

export function formatLiquidityHubSetupCode(data: JsonContainer): string {
  const { chainId, partner } = getExampleParams(data);

  return `import { createClient } from "@orbs-network/liquidity-hub-sdk";

const chainId = ${chainId};
${formatLiquidityHubPartnerDeclaration(partner)}

export const liquidityHub = createClient({
  chainId,
  partner,
});`;
}

export function formatLiquidityHubTypesCode(): string {
  return `import type { Quote, QuoteArgs } from "@orbs-network/liquidity-hub-sdk";

export type { Address, Hash } from "viem";

export type LiquidityHubQuoteArgs = QuoteArgs;

export type LiquidityHubQuote = Quote & {
  amountOutUI?: string;
  inTokenUsd?: number;
  outTokenUsd?: number;
};`;
}

export function formatLiquidityHubPermitSigningCode(): string {
  return formatLiquidityHubSdkStep("sign");
}

export function formatLiquidityHubCurrentQuoteCode(
  data: JsonContainer,
): string {
  const { quote } = getLiveFlowCodeValues(data);

  return `import type { LiquidityHubQuote } from "./liquidity-hub-types";

export const currentLiquidityHubQuote = ${quote} as LiquidityHubQuote;`;
}

export function formatLiquidityHubGetLatestQuoteCode(
  data: JsonContainer,
): string {
  const root = Array.isArray(data) ? {} : data;
  const quotePayload = getRecord(root.quote);
  const { chainId, partner } = getExampleParams(data);

  return `import { createClient, isFreshQuote } from "@orbs-network/liquidity-hub-sdk";
import type { LiquidityHubQuote } from "./types";

const chainId = ${chainId};
${formatLiquidityHubPartnerDeclaration(partner)}
const liquidityHub = createClient({ chainId, partner });
let quotePayload = ${formatJsonObject(quotePayload)} as LiquidityHubQuote;

export function getLatestQuote(): LiquidityHubQuote | Promise<LiquidityHubQuote> {
  if (!isFreshQuote(quotePayload, 60)) {
    const originalQuote = quotePayload;
    return liquidityHub
      .getQuote({
        fromToken: originalQuote.inToken,
        toToken: originalQuote.outToken,
        inAmount: originalQuote.inAmount,
        dexMinAmountOut: "-1",
        slippage: originalQuote.slippage,
        account: originalQuote.user,
      })
      .then((freshQuote) => {
        if (BigInt(freshQuote.minAmountOut) < BigInt(originalQuote.minAmountOut)) {
          return originalQuote;
        }
        quotePayload = freshQuote;
        return quotePayload;
      })
      .catch(() => originalQuote);
  }

  return quotePayload;
}

/*
Latest quote flow

1. Start with the exact Liquidity Hub quote response already owned by the flow.
2. Use the SDK's isFreshQuote() check to keep that payload while it is valid.
3. When stale, request the same tokens, total input amount, slippage, and wallet.
   dexMinAmountOut is -1 because this flow executes Liquidity Hub only.
4. Keep the original quote if refresh fails or returns a lower minAmountOut.
5. Otherwise replace quotePayload so signing and swap use the same quote.
6. Callers await getLatestQuote(); the fresh path returns immediately, while the
   stale path resolves after the replacement quote is fetched.
*/`;
}

export function formatLiquidityHubQuoteCode(data: JsonContainer): string {
  return formatLiquidityHubLiveQuoteCode(data);
}

export function formatLiquidityHubLiveQuoteCode(data: JsonContainer): string {
  const { chainId, partner, quoteArgs } = getExampleParams(data);
  const serializedQuoteArgs = formatTypeScriptObject(quoteArgs);

  return `import { createClient } from "@orbs-network/liquidity-hub-sdk";
import type { LiquidityHubQuote, LiquidityHubQuoteArgs } from "./types";

const chainId = ${chainId}; // Use the connected wallet's active chain ID.
${formatLiquidityHubPartnerDeclaration(partner)}
const quoteArgs = ${serializedQuoteArgs} satisfies LiquidityHubQuoteArgs;
const liquidityHub = createClient({ chainId, partner });

export async function getLiquidityHubQuote(): Promise<LiquidityHubQuote> {
  return liquidityHub.getQuote(quoteArgs);
}

/*
Quote flow

1. Build quoteArgs from the quote data already owned by the swap form.
2. Use the wrapped ERC-20 address when the selected source is native currency.
3. Fetch and preserve the complete wallet-bound Liquidity Hub quote.
*/`;
}

function getLiveFlowCodeValues(data: JsonContainer) {
  const root = Array.isArray(data) ? {} : data;
  const quote = getRecord(root.quote);
  const execution = getRecord(root.execution);
  const quoteValue = Object.keys(quote).length
    ? quote
    : getRecord(LIQUIDITY_HUB_QUOTE_EXAMPLE_RESPONSE_DATA);

  return {
    quote: formatTypeScriptObject(quoteValue),
    signature: getString(execution.signature, "<wallet-signature>"),
    txHash: getString(execution.txHash, "<swap-transaction-hash>"),
  };
}

export function formatLiquidityHubWrapCode(): string {
  return formatLiquidityHubSdkStep("wrap");
}

export function formatLiquidityHubApprovalCode(): string {
  return formatLiquidityHubSdkStep("approve");
}

export function formatLiquidityHubAllowanceCode(data: JsonContainer = {}): string {
  const root = Array.isArray(data) ? {} : data;
  const quote = getRecord(root.quote);
  const quoteArgs = getRecord(root.quoteArgs);
  const code = formatLiquidityHubSdkStep("check");
  if (!Object.keys(quote).length && !Object.keys(quoteArgs).length) return code;
  const token = getString(quote.inToken, getString(quoteArgs.fromToken, DEFAULT_INPUT_TOKEN));
  const account = getString(quote.user, getString(quoteArgs.account, DEFAULT_ACCOUNT));
  const amount = getString(quote.inAmount, getString(quoteArgs.inAmount, "0"));
  return code
    .replace("  account: Address,", `  account: Address, // ${JSON.stringify(account)}`)
    .replace("  token: Address,", `  token: Address, // ${JSON.stringify(token)}`)
    .replace("  spender: Address,", '  spender: Address, // Permit2: 0x000000000022D473030F116dDEE9F6B43aC78BA3')
    .replace("  amount: bigint,", `  amount: bigint, // ${JSON.stringify(amount)} (token base units)`);

}

export function formatLiquidityHubSignCode(): string {
  return formatLiquidityHubSdkStep("sign");
}

export function formatLiquidityHubSwapAndConfirmCode(): string {
  return formatLiquidityHubSdkStep("swap");
}

export const formatLiquidityHubFullFlowCode = formatLiquidityHubSdkFlow;

export function formatLiquidityHubSwapCode(): string {
  return formatLiquidityHubSdkStep("swap");
}

const COMPACT_TYPES_FILE: CodeSnippetFileOptions = {
  format: formatLiquidityHubTypesCode,
  name: "types.ts",
  showFieldTooltips: false,
  syntaxLanguage: "typescript",
};

export const LIQUIDITY_HUB_SETUP_CODE_SNIPPET: CodeSnippetOptions = {
  copyLabel: "Copy code",
  fileName: "liquidity-hub.ts",
  format: formatLiquidityHubSetupCode,
  language: "TypeScript",
  syntaxLanguage: "typescript",
};

export const LIQUIDITY_HUB_QUOTE_CODE_SNIPPET = LIQUIDITY_HUB_SDK_FLOW;

export const LIQUIDITY_HUB_LIVE_QUOTE_CODE_SNIPPET: CodeSnippetOptions = {
  copyLabel: "Copy code",
  fileName: "quote.ts",
  files: [COMPACT_TYPES_FILE],
  format: formatLiquidityHubLiveQuoteCode,
  language: "TypeScript",
  syntaxLanguage: "typescript",
};

export const LIQUIDITY_HUB_WRAP_CODE_SNIPPET: CodeSnippetOptions = {
  copyLabel: "Copy code",
  fileName: "wrap.ts",
  format: () => formatLiquidityHubSdkStep("wrap"),
  language: "TypeScript",
  syntaxLanguage: "typescript",
};

export const LIQUIDITY_HUB_APPROVAL_CODE_SNIPPET: CodeSnippetOptions = {
  copyLabel: "Copy code",
  fileName: "approve.ts",
  format: () => formatLiquidityHubSdkStep("approve"),
  language: "TypeScript",
  syntaxLanguage: "typescript",
};

export const LIQUIDITY_HUB_ALLOWANCE_CODE_SNIPPET: CodeSnippetOptions = {
  copyLabel: "Copy code",
  fileName: "check.ts",
  format: formatLiquidityHubAllowanceCode,
  language: "TypeScript",
  syntaxLanguage: "typescript",
};

export const LIQUIDITY_HUB_SIGN_CODE_SNIPPET: CodeSnippetOptions = {
  copyLabel: "Copy code",
  fileName: "sign.ts",
  format: () => formatLiquidityHubSdkStep("sign"),
  formatEdit: (data) => formatLiquidityHubSdkStep("sign", data),
  inlineEditable: true,
  language: "TypeScript",
  syntaxLanguage: "typescript",
};

export const LIQUIDITY_HUB_SWAP_AND_CONFIRM_CODE_SNIPPET: CodeSnippetOptions = {
  copyLabel: "Copy code",
  fileName: "swap.ts",
  format: (data) => formatLiquidityHubSdkStep("swap", data),
  language: "TypeScript",
  syntaxLanguage: "typescript",
};

export const LIQUIDITY_HUB_FULL_FLOW_CODE_SNIPPET = LIQUIDITY_HUB_SDK_FLOW;

export const LIQUIDITY_HUB_SWAP_CODE_SNIPPET: CodeSnippetOptions = {
  copyLabel: "Copy code",
  fileName: "swap.ts",
  format: (data) => formatLiquidityHubSdkStep("swap", data),
  language: "TypeScript",
  syntaxLanguage: "typescript",
};

const FIELD_EXPLANATIONS: Record<string, string> = {
  partner:
    'The partner name provided by Orbs. Use "external" when no partner name was provided.',
  chainId: "The connected EVM chain used to initialize the SDK.",
  inputIsNative:
    "Whether the DEX source selection is native currency. Liquidity Hub accepts only its wrapped ERC-20 address as inToken, so the quoted amount must be wrapped before approval.",
  quoteArgs:
    "The complete input used to request a market-sensitive Liquidity Hub quote.",
  "quoteArgs.fromToken":
    "The input token must be an ERC-20 address and must not be native currency. When the user selects native input, pass its wrapped-token address and wrap the amount before execution.",
  "quoteArgs.toToken":
    "The ERC-20 token address Liquidity Hub should return from the swap.",
  "quoteArgs.inAmount":
    "The total input amount as an integer string in the input token’s smallest unit.",
  "quoteArgs.dexMinAmountOut":
    "The DEX router’s slippage-adjusted minimum output in base units. Pass the real DEX minimum when comparing routes; use -1 only when no DEX quote is available, as in this Liquidity Hub-only reference.",
  "quoteArgs.slippage":
    "The allowed slippage as a percentage; for example, 0.5 means 0.5%.",
  "quoteArgs.account":
    "The connected wallet used to bind the quote. This wallet must sign and execute the swap.",
  "quoteArgs.signal":
    "An optional AbortSignal used to cancel a quote request when the form inputs change.",
  "quoteArgs.timeout":
    "An optional quote-request timeout override expressed in milliseconds.",
  "quoteArgs.inAmountUsd":
    "Optional USD value of the source amount.",
  "quoteArgs.disabled":
    "Deprecated. Prevent disabled quote requests in the host application instead.",
  inToken: "The wrapped ERC-20 input token used by the accepted quote.",
  outToken: "The ERC-20 output token returned by the quote.",
  inAmount: "The quoted input amount in base units.",
  outAmount: "The quoted output amount before the app's display adjustments.",
  minAmountOut: "The minimum output protected by the quote.",
  user: "The wallet bound to the quote and EIP-712 signature.",
  slippage: "The slippage percentage applied to the quote.",
  qs: "Opaque quote metadata returned by Liquidity Hub. Preserve it unchanged with the quote.",
  exchange:
    "The Liquidity Hub execution source selected for this quote. Preserve it unchanged.",
  sessionId:
    "The Liquidity Hub session identifier used to correlate the quote, swap, and transaction details.",
  serializedOrder:
    "The opaque serialized solver order returned by Liquidity Hub. Submit it unchanged as part of the quote.",
  permitData:
    "The raw Permit2 representation retained on the quote for SDK compatibility. The reference signer uses the wallet-ready eip712 payload.",
  "permitData.domain":
    "The EIP-712 domain supplied by Liquidity Hub for the Permit2 signature.",
  "permitData.domain.name":
    "The protocol name included in the EIP-712 signing domain.",
  "permitData.domain.chainId":
    "The chain ID on which this Permit2 signature is valid.",
  "permitData.domain.verifyingContract":
    "The Permit2 contract that verifies the EIP-712 signature on this chain.",
  "permitData.types":
    "The complete EIP-712 type definitions returned by Liquidity Hub. Do not rebuild or edit them.",
  "permitData.types.PermitWitnessTransferFrom":
    "The ordered fields that define the Permit2 witness-transfer signature.",
  "permitData.types.PermitWitnessTransferFrom.name":
    "The exact EIP-712 field name in the witness-transfer type definition.",
  "permitData.types.PermitWitnessTransferFrom.type":
    "The exact Solidity/EIP-712 type paired with this witness-transfer field.",
  "permitData.types.TokenPermissions":
    "The EIP-712 type describing the permitted token and maximum transferable amount.",
  "permitData.types.TokenPermissions.name":
    "The exact EIP-712 field name in the token-permission type definition.",
  "permitData.types.TokenPermissions.type":
    "The exact Solidity/EIP-712 type paired with this token-permission field.",
  "permitData.values":
    "The raw Permit2 message values returned by Liquidity Hub. Preserve them unchanged.",
  "permitData.values.permitted":
    "The input-token permission covered by this signature.",
  "permitData.values.permitted.token":
    "The ERC-20 input token authorized by the Permit2 signature.",
  "permitData.values.permitted.amount":
    "The maximum input-token amount authorized by the signature, in base units.",
  "permitData.values.spender":
    "The contract authorized to consume the signed Permit2 transfer.",
  "permitData.values.nonce":
    "The Permit2 nonce that prevents this signature from being replayed.",
  "permitData.values.deadline":
    "The Unix timestamp after which the Permit2 signature expires.",
  "permitData.values.witness":
    "The raw Dutch-order witness bound to the Permit2 authorization.",
  eip712:
    "The SDK-provided, wallet-ready EIP-712 payload signed directly by walletClient.signTypedData.",
  "eip712.domain":
    "The wallet-ready EIP-712 domain for the Permit2 signature.",
  "eip712.types":
    "The complete wallet-ready EIP-712 type definitions.",
  "eip712.primaryType":
    "The root EIP-712 type the wallet signs for this Liquidity Hub quote.",
  "eip712.message":
    "The wallet-ready Permit2 message passed unchanged to the signing hook.",
  "eip712.message.permitted":
    "The input-token permission covered by this Permit2 signature.",
  "eip712.message.permitted.token":
    "The ERC-20 input token authorized by the Permit2 signature.",
  "eip712.message.permitted.amount":
    "The maximum input-token amount authorized by the signature, in base units.",
  "eip712.message.spender":
    "The contract authorized to consume the signed Permit2 transfer.",
  "eip712.message.nonce":
    "The Permit2 nonce that prevents this signature from being replayed.",
  "eip712.message.deadline":
    "The Unix timestamp after which the Permit2 signature expires.",
  "eip712.message.witness":
    "The order data bound to the Permit2 signature. Preserve the complete witness unchanged.",
  "eip712.message.witness.info":
    "The order identity, expiry, and additional-validation settings bound to the witness.",
  "eip712.message.witness.info.reactor":
    "The reactor contract responsible for executing the signed order.",
  "eip712.message.witness.info.swapper":
    "The wallet that owns and signs the witnessed order.",
  "eip712.message.witness.info.nonce":
    "The witnessed order nonce used to prevent replay.",
  "eip712.message.witness.info.deadline":
    "The Unix timestamp after which the witnessed order can no longer execute.",
  "eip712.message.witness.info.additionalValidationContract":
    "The contract that performs any extra validation required by this order.",
  "eip712.message.witness.info.additionalValidationData":
    "Opaque validation data passed unchanged to the additional-validation contract.",
  "eip712.message.witness.decayStartTime":
    "The Unix timestamp when the order’s Dutch-auction amount begins decaying.",
  "eip712.message.witness.decayEndTime":
    "The Unix timestamp when the order’s Dutch-auction amount finishes decaying.",
  "eip712.message.witness.exclusiveFiller":
    "The address granted exclusive fill rights during the exclusivity window.",
  "eip712.message.witness.exclusivityOverrideBps":
    "The output adjustment, in basis points, required for a non-exclusive filler to execute during the exclusivity window.",
  "eip712.message.witness.inputToken":
    "The ERC-20 input token consumed by the witnessed order.",
  "eip712.message.witness.inputStartAmount":
    "The input amount at the start of the decay period, in token base units.",
  "eip712.message.witness.inputEndAmount":
    "The input amount at the end of the decay period, in token base units.",
  "eip712.message.witness.outputs":
    "The ordered output transfers produced when the witnessed order executes.",
  "eip712.message.witness.outputs.token":
    "The ERC-20 token transferred by this output entry.",
  "eip712.message.witness.outputs.startAmount":
    "This output’s amount at the start of the decay period, in token base units.",
  "eip712.message.witness.outputs.endAmount":
    "This output’s amount at the end of the decay period, in token base units.",
  "eip712.message.witness.outputs.recipient":
    "The address that receives this output transfer.",
  userMinOutAmountWithGas:
    "The user's protected minimum output after Liquidity Hub accounts for gas effects.",
  outAmountWsMinusGas:
    "The slippage-adjusted output after subtracting the output-token value of estimated gas.",
  outAmountWS:
    "The quoted output after applying the configured slippage protection.",
  gasAmountOut:
    "The estimated gas cost expressed in destination-token base units.",
  referencePrice:
    "The reference market price recorded with the quote for diagnostics.",
  amountOutUI:
    "The comparison amount echoed by the quote service for UI diagnostics.",
  inTokenUsd:
    "The source token USD reference price used by the quote service.",
  outTokenUsd:
    "The destination token USD reference price used by the quote service.",
  timestamp: "The quote creation time used to reject stale execution data.",
  error: "A non-executable quote error. Only 'not supported' and 'ldv' stop polling; other failures follow the host retry policy.",
};

export function getLiquidityHubFieldExplanation(
  path: JsonValuePath,
): string | undefined {
  const withoutQuoteRoot =
    path[0] === "quote" && path.length > 1 ? path.slice(1) : path;
  const normalizedPath = withoutQuoteRoot.filter(
    (segment) => typeof segment !== "number",
  );

  return FIELD_EXPLANATIONS[normalizedPath.join(".")];
}

export const LIQUIDITY_HUB_EXAMPLE_DATA = {
  partner: "external",
  chainId: DEFAULT_CHAIN_ID,
  inputIsNative: false,
  quoteArgs: {
    fromToken: DEFAULT_INPUT_TOKEN,
    toToken: DEFAULT_OUTPUT_TOKEN,
    inAmount: "1000000000000000000",
    dexMinAmountOut: "2480000000",
    slippage: 0.5,
    account: DEFAULT_ACCOUNT,
  },
} satisfies JsonContainer;

const EXAMPLE_REACTOR = "0x2222222222222222222222222222222222222222";
const EXAMPLE_FILLER = "0x3333333333333333333333333333333333333333";
const EXAMPLE_FEE_RECIPIENT =
  "0x4444444444444444444444444444444444444444";
const EXAMPLE_VALIDATION_CONTRACT =
  "0x7777777777777777777777777777777777777777";
const EXAMPLE_PERMIT2_DOMAIN = {
  name: "Permit2",
  chainId: DEFAULT_CHAIN_ID,
  verifyingContract: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
};
const EXAMPLE_PERMIT_TYPES = {
  PermitWitnessTransferFrom: [
    { name: "permitted", type: "TokenPermissions" },
    { name: "spender", type: "address" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
    { name: "witness", type: "ExclusiveDutchOrder" },
  ],
  TokenPermissions: [
    { name: "token", type: "address" },
    { name: "amount", type: "uint256" },
  ],
  ExclusiveDutchOrder: [
    { name: "info", type: "OrderInfo" },
    { name: "decayStartTime", type: "uint256" },
    { name: "decayEndTime", type: "uint256" },
    { name: "exclusiveFiller", type: "address" },
    { name: "exclusivityOverrideBps", type: "uint256" },
    { name: "inputToken", type: "address" },
    { name: "inputStartAmount", type: "uint256" },
    { name: "inputEndAmount", type: "uint256" },
    { name: "outputs", type: "DutchOutput[]" },
  ],
  OrderInfo: [
    { name: "reactor", type: "address" },
    { name: "swapper", type: "address" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
    { name: "additionalValidationContract", type: "address" },
    { name: "additionalValidationData", type: "bytes" },
  ],
  DutchOutput: [
    { name: "token", type: "address" },
    { name: "startAmount", type: "uint256" },
    { name: "endAmount", type: "uint256" },
    { name: "recipient", type: "address" },
  ],
};
const EXAMPLE_EIP712_MESSAGE = {
  permitted: {
    token: DEFAULT_INPUT_TOKEN,
    amount: "1000000000000000000",
  },
  spender: EXAMPLE_REACTOR,
  nonce: "1788217200123",
  deadline: 1788220800,
  witness: {
    info: {
      reactor: EXAMPLE_REACTOR,
      swapper: DEFAULT_ACCOUNT,
      nonce: "1788217200123",
      deadline: 1788220800,
      additionalValidationContract: EXAMPLE_VALIDATION_CONTRACT,
      additionalValidationData: "0x",
    },
    decayStartTime: 1788217200,
    decayEndTime: 1788217260,
    exclusiveFiller: EXAMPLE_FILLER,
    exclusivityOverrideBps: "0",
    inputToken: DEFAULT_INPUT_TOKEN,
    inputStartAmount: "1000000000000000000",
    inputEndAmount: "1000000000000000000",
    outputs: [
      {
        token: DEFAULT_OUTPUT_TOKEN,
        startAmount: "1000000",
        endAmount: "1000000",
        recipient: EXAMPLE_FEE_RECIPIENT,
      },
      {
        token: DEFAULT_OUTPUT_TOKEN,
        startAmount: "2495000000",
        endAmount: "2482525000",
        recipient: DEFAULT_ACCOUNT,
      },
    ],
  },
};

export const LIQUIDITY_HUB_QUOTE_EXAMPLE_RESPONSE_DATA = {
  inToken: DEFAULT_INPUT_TOKEN,
  outToken: DEFAULT_OUTPUT_TOKEN,
  inAmount: "1000000000000000000",
  outAmount: "2495000000",
  user: DEFAULT_ACCOUNT,
  slippage: 0.5,
  qs: "%3FinputCurrency%3D0x1111%26outputCurrency%3D0x6666%26swapType%3D1",
  partner: "external",
  exchange: "lh",
  sessionId: "example-session_137",
  serializedOrder: "0x1234",
  permitData: {
    domain: EXAMPLE_PERMIT2_DOMAIN,
    types: EXAMPLE_PERMIT_TYPES,
    values: {
      ...EXAMPLE_EIP712_MESSAGE,
      permitted: {
        token: DEFAULT_INPUT_TOKEN,
        amount: { type: "BigNumber", hex: "0x0de0b6b3a7640000" },
      },
      nonce: { type: "BigNumber", hex: "0x2a" },
      witness: {
        ...EXAMPLE_EIP712_MESSAGE.witness,
        info: {
          ...EXAMPLE_EIP712_MESSAGE.witness.info,
          nonce: { type: "BigNumber", hex: "0x2a" },
        },
        exclusivityOverrideBps: { type: "BigNumber", hex: "0x00" },
        inputStartAmount: {
          type: "BigNumber",
          hex: "0x0de0b6b3a7640000",
        },
        inputEndAmount: {
          type: "BigNumber",
          hex: "0x0de0b6b3a7640000",
        },
        outputs: [
          {
            ...EXAMPLE_EIP712_MESSAGE.witness.outputs[0],
            startAmount: { type: "BigNumber", hex: "0x0f4240" },
            endAmount: { type: "BigNumber", hex: "0x0f4240" },
          },
          {
            ...EXAMPLE_EIP712_MESSAGE.witness.outputs[1],
            startAmount: { type: "BigNumber", hex: "0x94b6adc0" },
            endAmount: { type: "BigNumber", hex: "0x93f85348" },
          },
        ],
      },
    },
  },
  eip712: {
    domain: EXAMPLE_PERMIT2_DOMAIN,
    types: EXAMPLE_PERMIT_TYPES,
    primaryType: "PermitWitnessTransferFrom",
    message: EXAMPLE_EIP712_MESSAGE,
  },
  outAmountWS: "2495000000",
  outAmountWsMinusGas: "2494000000",
  minAmountOut: "2482525000",
  amountOutUI: "-1",
  inTokenUsd: 2500,
  outTokenUsd: 1,
  gasAmountOut: "1000000",
  referencePrice: "2495000000",
  userMinOutAmountWithGas: "2482525000",
  timestamp: 1788217200000,
} satisfies JsonContainer;
