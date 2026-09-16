import { ADVANCED_ORDERS_SDK_FLOW, formatAdvancedOrdersSdkFlow, formatAdvancedOrdersSdkStep } from "./sdk-flow-examples";
import type {
  CodeSnippetOptions,
  JsonContainer,
  JsonPrimitive,
  JsonValue,
  JsonValuePath,
} from "./json-inspector";
import {
  formatPartnerDeclaration,
  getExamplePartnerId,
} from "./developer-partner";

const ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;

function serializeTypeScriptValue(
  value: JsonValue,
  getExpression: (path: JsonValuePath) => string | undefined,
  path: JsonValuePath = [],
  indent = 0,
  getComment: (path: JsonValuePath) => string | undefined = () =>
    undefined,
): string {
  const expression = getExpression(path);
  if (expression) return expression;

  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  const entries = Array.isArray(value)
    ? value.map((entry, index) => [index, entry] as const)
    : Object.entries(value);
  const opening = Array.isArray(value) ? "[" : "{";
  const closing = Array.isArray(value) ? "]" : "}";
  if (!entries.length) return `${opening}${closing}`;

  const childIndent = indent + 2;
  const lines = entries.map(([key, entry], index) => {
    const entryPath = [...path, key];
    const propertyName = String(key);
    const prefix = Array.isArray(value)
      ? ""
      : `${
          /^[A-Za-z_$][\w$]*$/.test(propertyName)
            ? propertyName
            : JSON.stringify(propertyName)
        }: `;

    const serializedEntry = serializeTypeScriptValue(
      entry,
      getExpression,
      entryPath,
      childIndent,
      getComment,
    );
    const trailingComma = index < entries.length - 1 ? "," : "";
    const comment = getComment(entryPath);

    return `${" ".repeat(childIndent)}${prefix}${serializedEntry}${trailingComma}${comment ? ` // ${comment}` : ""}`;
  });

  return `${opening}\n${lines.join("\n")}\n${" ".repeat(indent)}${closing}`;
}

const SIGNATURE_FIELD_EXPLANATIONS: Record<string, string> = {
  signature:
    "The complete 65-byte EIP-712 signature returned directly by the wallet.",
  chainId:
    "The active chain selected by the DEX. It is used to fetch and validate protocol configuration.",
  tokenAddress:
    "The DEX-derived ERC-20 input address authorized by RePermit. Use WToken when the user selected native input.",
  inputTokenAddress:
    "The DEX-derived ERC-20 address consumed by each fill. Native input is unsupported, so this must be WToken.",
  requiredAmount:
    "The total input amount calculated by the DEX, expressed in the token's smallest unit.",
  message:
    "The complete EIP-712 RePermit order message that the wallet signs.",
  "message.permitted":
    "The token permission covered by this signature, including its token and maximum amount.",
  "message.permitted.token":
    "The source token contract authorized by the RePermit signature.",
  "message.permitted.amount":
    "The maximum source-token amount authorized by this signature, in the token's smallest unit.",
  "message.spender":
    "The signed reactor returned by configuration. ERC-20 allowance targets domain.verifyingContract instead.",
  "message.nonce":
    "A unique value that prevents this signed permission from being replayed.",
  "message.deadline":
    "The Unix timestamp, in seconds, after which the signed permission expires.",
  "message.witness":
    "The execution rules bound to the token permission as the signed order witness.",
  "message.witness.reactor":
    "The reactor contract that validates and processes this order.",
  "message.witness.executor":
    "The executor contract authorized to execute the order.",
  "message.witness.exchange":
    "Exchange-routing and fee metadata used when a fill is executed.",
  "message.witness.exchange.adapter":
    "The adapter contract used to route the token exchange.",
  "message.witness.exchange.ref":
    "The referral or fee-recipient address associated with the exchange.",
  "message.witness.exchange.share":
    "The configured referral fee share. Zero means no referral share is applied.",
  "message.witness.exchange.data":
    "Optional adapter-specific calldata. 0x means no extra adapter data is supplied.",
  "message.witness.swapper":
    "The wallet that owns the input tokens and signs the order.",
  "message.witness.nonce":
    "The order nonce used to uniquely identify the witness and prevent replay.",
  "message.witness.start":
    "The Unix timestamp, in seconds, from which the order may begin executing.",
  "message.witness.deadline":
    "The Unix timestamp, in seconds, after which the order can no longer execute.",
  "message.witness.chainid":
    "The EVM chain ID on which this order is valid.",
  "message.witness.exclusivity":
    "The order's exclusive-execution constraint. Zero means no exclusivity window is configured.",
  "message.witness.epoch":
    "The delay between eligible fills, expressed in seconds. Zero allows a single immediate fill.",
  "message.witness.slippage":
    "The price-protection tolerance in basis points; 100 basis points equals 1%.",
  "message.witness.freshness":
    "The maximum freshness window used when validating execution data, in seconds.",
  "message.witness.input":
    "The source-token amounts and limits applied to each order fill.",
  "message.witness.input.token":
    "The source token contract supplied to each fill.",
  "message.witness.input.amount":
    "The source-token amount allocated to one fill, in the token's smallest unit.",
  "message.witness.input.maxAmount":
    "The maximum total source-token amount that may be consumed by the order.",
  "message.witness.output":
    "The destination token, minimum output, trigger thresholds, and recipient for each fill.",
  "message.witness.output.token":
    "The destination token contract the order receives.",
  "message.witness.output.limit":
    "The minimum destination-token amount accepted per fill, in the token's smallest unit.",
  "message.witness.output.triggerLower":
    "The lower trigger threshold. It is populated for stop-loss orders and otherwise set to zero.",
  "message.witness.output.triggerUpper":
    "The upper trigger threshold. It is populated for take-profit orders and otherwise set to zero.",
  "message.witness.output.recipient":
    "The wallet that receives destination tokens from completed fills.",
  domain:
    "Server-controlled EIP-712 domain. Preserve it unchanged when signing.",
  "domain.name": "Server-controlled EIP-712 domain name.",
  "domain.version": "Server-controlled EIP-712 domain version.",
  "domain.chainId":
    "Configured EVM chain ID. It must match the connected chain and witness.chainid.",
  "domain.verifyingContract":
    "RePermit contract that verifies the signature and receives ERC-20 allowance.",
  primaryType:
    "Root EIP-712 type returned by the service; pass it to the wallet unchanged.",
  types:
    "Complete server-controlled EIP-712 type map; pass it to the wallet unchanged.",
  partner: "Partner identifier resolved by the configuration service.",
};

const CANCEL_FIELD_EXPLANATIONS: Record<string, string> = {
  partner:
    "The Orders Sink partner ID used to resolve the trusted RePermit configuration.",
  abi: "The cancel function signature used to encode this contract call.",
  functionName: "The smart-contract function invoked to cancel the order.",
  address: "The RePermit contract that owns the order.",
  args: "The order identifier passed to the cancel function. Legacy orders use an ID; RePermit orders use a digest array.",
  chain: "The EVM chain on which the cancellation transaction is submitted.",
  account:
    "The connected wallet that submits and pays for the cancellation transaction.",
};

const FETCH_ORDERS_RESPONSE_FIELD_EXPLANATIONS: Record<string, string> = {
  "orders.hash": "The unique hash used to identify this submitted order.",
  "orders.metadata.expectedChunks":
    "The number of order fills expected when the complete order executes.",
  "orders.metadata.lastPriceCheck":
    "The most recent time the service evaluated this order's execution price.",
  "orders.metadata.nextEligibleTime":
    "The earliest time the next order fill may be attempted.",
  "orders.metadata.status":
    "The order's current execution status reported by Orders Sink.",
  "orders.metadata.description":
    "A human-readable description of the order strategy.",
  "orders.metadata.displayOnlyInputTokenPriceUSD":
    "The input token's display-only USD price as an 18-decimal fixed-point integer. Format it before showing users.",
  "orders.metadata.repermitDigest":
    "The RePermit order digest used to identify and cancel this order.",
  "orders.signature":
    "The wallet signature authorizing the submitted RePermit order.",
  "orders.timestamp": "The time the order was accepted by Orders Sink.",
};

export function isSignatureValueEditable(
  path: JsonValuePath,
  value: JsonPrimitive,
) {
  if (path[0] === "message") return true;

  const fieldName = path.at(-1);
  if (
    fieldName === "chainId" ||
    fieldName === "chainid" ||
    fieldName === "data" ||
    fieldName === "share"
  ) {
    return false;
  }

  return typeof value !== "string" || !ADDRESS_PATTERN.test(value);
}

export function getSignatureFieldExplanation(path: JsonValuePath) {
  return SIGNATURE_FIELD_EXPLANATIONS[path.join(".")];
}

export function getSignatureMessageFieldExplanation(path: JsonValuePath, value: JsonValue) {
  if (path[0] !== "message" || (typeof value !== "string" && typeof value !== "number")) {
    return undefined;
  }
  return getSignatureFieldExplanation(path);
}

export function getPermitDataFieldExplanation(path: JsonValuePath) {
  const normalizedPath =
    path[0] === "order" ? ["message", ...path.slice(1)] : path;

  return getSignatureFieldExplanation(normalizedPath);
}

export function getFetchOrdersResponseFieldExplanation(path: JsonValuePath) {
  const orderIndex = path.findIndex((segment) => segment === "order");
  if (orderIndex >= 0) {
    return getSignatureFieldExplanation([
      "message",
      ...path.slice(orderIndex + 1),
    ]);
  }

  const normalizedPath = path
    .filter((segment) => typeof segment !== "number")
    .join(".");

  return FETCH_ORDERS_RESPONSE_FIELD_EXPLANATIONS[normalizedPath];
}

function getCreatedOrderFieldExplanation(path: JsonValuePath) {
  return getFetchOrdersResponseFieldExplanation(["orders", ...path]);
}

export function isApprovalValueEditable(
  _path: JsonValuePath,
  value: JsonPrimitive,
) {
  return typeof value !== "string" || !ADDRESS_PATTERN.test(value);
}

export function getCancelFieldExplanation(path: JsonValuePath) {
  return CANCEL_FIELD_EXPLANATIONS[path.join(".")];
}

export function formatOrderTypesCode() {
  return `// Ethereum-compatible addresses and hex values used by viem and Wagmi.
export type Address = \`0x\${string}\`;
export type Hex = \`0x\${string}\`;

// Complete 65-byte EIP-712 signature returned by the wallet. Keep it intact;
// POST /orders/new accepts the regular hex signature, not separate v/r/s fields.
export type Signature = Hex;

// Shape returned by the host DEX's useDerivedData() hook.
export type OrderInput = {
  inputToken: {
    address: Address;
  };
  dstToken: Address;
  sourceIsNative: boolean;
  totalInputAmount: string;
  srcAmountPerFill: string;
  dstMinAmountPerFill: string;
  deadlineMillis: number;
  fillDelayMillis: number;
  totalTrades: number;
  slippageBps: number;
  // Omit to use the protocol's normal 60-second freshness window.
  freshnessSeconds?: number;
  triggerLower: string;
  triggerUpper: string;
};

// The exact EIP-712 message signed by the wallet and submitted to Orders Sink.
// Numeric uint values are strings when they can exceed JavaScript's safe range.
export type PermitOrder = {
  // Permit scope: the ERC-20 token and total amount authorized by this signature.
  permitted: {
    // Use an ERC-20 address. Native input is unsupported, so use WToken instead.
    token: Address;
    // Maximum total amount the permit may transfer, in token base units.
    amount: string;
  };
  // Signed reactor spender returned by GET /config. ERC-20 allowance instead
  // targets domain.verifyingContract (RePermit).
  spender: Address;
  // Fresh nonce generated once for both the permit and its witness.
  nonce: string;
  // Permit expiry as Unix seconds. Expired orders cannot execute.
  deadline: string;
  // Strategy-specific data covered by the same wallet signature.
  witness: {
    // Protocol reactor returned by GET /config.
    reactor: Address;
    // Protocol executor returned by GET /config.
    executor: Address;
    // Exchange integration selected by the trusted partner configuration.
    exchange: {
      // Adapter used to execute the swap.
      adapter: Address;
      // Optional referral address.
      ref: Address;
      // Server-configured uint32 fee/referral share; preserve it unchanged.
      share: number;
      // Optional adapter-specific calldata; use 0x when empty.
      data: Hex;
    };
    // Wallet that owns the input tokens and signs the typed data.
    swapper: Address;
    // Same value as the top-level permit nonce.
    nonce: string;
    // Earliest Unix-second timestamp at which execution may begin.
    start: string;
    // Latest Unix-second timestamp at which the order may execute.
    deadline: string;
    // Must match the connected wallet and EIP-712 domain chain IDs.
    chainid: number;
    // Protocol exclusivity setting returned by GET /config unless customized.
    exclusivity: number;
    // Minimum interval between eligible fills, in seconds.
    epoch: number;
    // Allowed execution slippage in basis points (100 = 1%).
    slippage: number;
    // Maximum quote/price age accepted by the strategy, in seconds.
    freshness: number;
    // Per-fill input constraints.
    input: {
      // Must match permitted.token; use WToken when the UI selected native input.
      token: Address;
      // Desired input per fill, in token base units.
      amount: string;
      // Maximum input available across fills, in token base units.
      maxAmount: string;
    };
    // Per-fill output constraints.
    output: {
      // ERC-20 token the strategy should receive.
      token: Address;
      // Minimum output accepted per fill, in output-token base units.
      limit: string;
      // Lower trigger boundary. Use "0" when the strategy does not use it.
      triggerLower: string;
      // Upper trigger boundary. Use "0" when the strategy does not use it.
      triggerUpper: string;
      // Address that receives output tokens; commonly the connected wallet.
      recipient: Address;
    };
  };
};

// One field declaration in the EIP-712 type map returned by GET /config.
export type TypedDataField = {
  name: string;
  type: string;
};

// Trusted protocol configuration used as the base for the local order.
export type PermitData = {
  // EIP-712 domain; never silently replace these values with user input.
  domain: {
    name: string;
    version: string;
    chainId: number;
    // RePermit contract and ERC-20 approval spender.
    verifyingContract: Address;
  };
  // Base order containing protocol contract and exchange fields.
  order: PermitOrder;
  // Root EIP-712 type used when requesting the wallet signature.
  primaryType: "RePermitWitnessTransferFrom";
  // Full EIP-712 type definitions supplied by the service.
  types: Record<string, TypedDataField[]>;
  // Partner identifier applied by Orders Sink, when present.
  partner?: string;
};

// Exact request body sent to POST /orders/new after signing.
export type SignedOrder = {
  signature: Signature;
  // This must be the same object used as signTypedData's message.
  order: PermitOrder;
  // New orders always enter the service as pending.
  status: "pending";
};

// Service-managed execution details returned with an order.
export type OrderMetadata = {
  // Execution chunks already processed by the strategy.
  chunks?: unknown[];
  // Total number of fills expected by the strategy.
  expectedChunks: number;
  // ISO timestamp of the last price evaluation.
  lastPriceCheck: string;
  // ISO timestamp at which another fill may become eligible.
  nextEligibleTime: string;
  // Service status such as pending, completed, or cancelled.
  status: string;
  // Human-readable strategy summary for display.
  description: string;
  // Display-only USD price; never use it for execution math.
  displayOnlyInputTokenPriceUSD: string;
  // On-chain digest passed to cancel(bytes32[] digests).
  repermitDigest: Hex;
};

// Raw order shape returned by Orders Sink.
export type OrderResponse = {
  // Orders Sink identifier for this signed order.
  hash: Hex;
  metadata: OrderMetadata;
  // The message originally signed and submitted.
  order: PermitOrder;
  signature: Signature;
  // ISO creation timestamp assigned by the service.
  timestamp: string;
};

// The create endpoint returns either the created order or an API error.
export type CreateOrderResponse =
  | {
      success: true;
      signedOrder: OrderResponse;
    }
  | {
      success: false;
      message?: string;
      code?: string | number;
    };

// Filters required by the order-history endpoint.
export type FetchOrdersQuery = {
  // Wallet whose orders should be returned.
  swapper: Address;
  // Network on which those orders execute.
  chainId: number;
  // Same partner ID used when submitting the orders.
  partner: string;
};

// Response body returned by the order-history endpoint.
export type FetchOrdersResponse = {
  orders: OrderResponse[];
};`;
}

export function formatSignOrderExampleCode() {
  return formatAdvancedOrdersSdkStep("sign");
}

export const formatFullOrderFlowCode = formatAdvancedOrdersSdkFlow;

export function formatWrapNativeTokenCode() {
  return formatAdvancedOrdersSdkStep("wrap");
}

export function formatLiveWrapNativeTokenCode() {
  return formatAdvancedOrdersSdkStep("wrap");
}

export function formatCreateOrderFetchCode() {
  return `import type { CreateOrderResponse, PermitOrder, Signature, SignedOrder } from "./order-types";

export async function createOrder(
  signature: Signature,
  order: PermitOrder,
) {
  // Orders Sink expects the signature, populated order, and pending state.
  const body: SignedOrder = {
    signature,
    order,
    status: "pending",
  };

  // Submit the signed order to Orders Sink.
  const response = await fetch(${JSON.stringify(CREATE_ORDER_EXAMPLE_URL)}, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const result = (await response.json().catch(() => ({}))) as CreateOrderResponse;

  // Surface transport and API errors separately.
  if (!response.ok) {
    throw new Error(\`Request failed (\${response.status})\`);
  }

  if (!result.success) {
    throw new Error(result.message ?? "Order creation failed");
  }

  // Return the created order from the successful response.
  return result.signedOrder;
}`;
}

function formatCreatedOrderCode(data: JsonContainer) {
  const serializedOrder = serializeTypeScriptValue(
    data,
    () => undefined,
  );

  return `// This is the actual order record returned by Orders Sink after POST /orders/new.
// Keep its service-managed ID, metadata, digest, and timestamps for display,
// status refreshes, and cancellation.
export const createdOrder = ${serializedOrder} as const;`;
}

export function formatLiveCreateOrderCode() {
  return formatAdvancedOrdersSdkStep("sign");
}

export function formatFetchOrdersCode(data: JsonContainer) {
  if (Array.isArray(data)) return JSON.stringify(data, null, 2);

  const query =
    data.query &&
    typeof data.query === "object" &&
    !Array.isArray(data.query)
      ? data.query
      : {};
  const swapper =
    typeof query.swapper === "string"
      ? query.swapper
      : "<connected-wallet-address>";
  const chainId =
    typeof query.chainId === "string" ||
    typeof query.chainId === "number"
      ? query.chainId
      : 1;
  const partner = getExamplePartnerId(query.partner ?? data.partner);

  return `import { createClient, Partners, type Order, type SpotClient } from "@orbs-network/spot-ui";

// Use the same enabled partner and connected chain as order submission.
const partner = Object.values(Partners).find((value) => value === ${JSON.stringify(partner)});
const chainId = ${JSON.stringify(Number(chainId))};

// Reuse one client per partner and chain. Discard failed initialization so it can retry.
let clientPromise: Promise<SpotClient> | undefined;
function getClient(): Promise<SpotClient> {
  if (!partner) throw new Error("Unknown Spot partner");
  clientPromise ??= createClient(partner, chainId).catch((error: unknown) => {
    clientPromise = undefined;
    throw error;
  });
  return clientPromise;
}

export async function fetchOrders(
  account = ${JSON.stringify(swapper)},
  signal?: AbortSignal,
): Promise<Order[]> {
  const client = await getClient();
  // This inspector shows v2 RePermit orders only. Omit legacyOrders to include v1.
  // V2 fetches all history with swapper, chainId, and partner; no exchange or pagination.
  const orders = await client.getAccountOrders({ account, signal, legacyOrders: false });
  // Key rendered rows and cached records by order.historyKey, not order.id.
  return orders;
}`;
}

export function formatPermitDataFetchCode(data: JsonContainer) {
  if (Array.isArray(data)) return JSON.stringify(data, null, 2);

  const endpoint =
    typeof data.endpoint === "string"
      ? data.endpoint
      : "https://order-sink-v2.orbs.network/config";
  const partner = getExamplePartnerId(data.partner);
  const chain =
    typeof data.chain === "string" || typeof data.chain === "number"
      ? data.chain
      : 137;

  return `import { isAddress, isAddressEqual, zeroAddress } from "viem";
import type { PermitData } from "./order-types";

${formatPartnerDeclaration(partner)}
const chainId = ${JSON.stringify(chain)};

export async function fetchRePermitData(
  partnerId: string,
  activeChainId: number,
): Promise<PermitData> {
  // Security boundary: keep this trusted endpoint fixed in your application.
  // Fetch the unchanged permit-data template for this partner and chain.
  const query = new URLSearchParams({
    partner: partnerId,
    chain: String(activeChainId),
  });
  const response = await fetch(
    \`${endpoint}?\${query}\`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
    },
  );

  // Do not use permit data returned by a failed request.
  if (!response.ok) {
    throw new Error(\`Failed to fetch permit data (\${response.status})\`);
  }

  const permitData = (await response.json()) as PermitData;
  assertPermitData(permitData, activeChainId);
  return permitData;
}

function assertPermitData(permitData: PermitData, activeChainId: number): void {
  const repermit = permitData.domain?.verifyingContract;
  const adapter = permitData.order?.witness?.exchange?.adapter;
  if (
    !isAddress(repermit) ||
    !isAddress(adapter) ||
    isAddressEqual(repermit, zeroAddress) ||
    isAddressEqual(adapter, zeroAddress)
  ) {
    throw new Error("Base permit data is missing contract addresses");
  }

  if (
    Number(permitData.domain.chainId) !== activeChainId ||
    Number(permitData.order.witness.chainid) !== activeChainId
  ) {
    throw new Error("Base permit data does not match the selected chain");
  }
}

// Call this for the active partner and connected wallet chain.
export const permitDataRequest = fetchRePermitData(partner, chainId);`;
}

export function formatCancelOrderCode() {
  return `import type { Order, SpotClient } from "@orbs-network/spot-ui";
import type { Abi, Address, PublicClient, WalletClient } from "viem";

const pending = new Set<string>();

// Pass the initialized client used for submission and an order from getAccountOrders().
export async function cancelOrder(
  client: SpotClient,
  order: Order,
  walletClient: WalletClient,
  publicClient: PublicClient,
  refreshOrders: () => Promise<unknown>,
) {
  const [accounts, chainId, publicChainId] = await Promise.all([
    walletClient.getAddresses(), walletClient.getChainId(), publicClient.getChainId(),
  ]);
  const account = accounts[0];
  if (!account || account.toLowerCase() !== order.maker.toLowerCase() ||
      chainId !== client.chainId || order.chainId !== chainId || publicChainId !== chainId) {
    throw new Error("Connect the order's wallet and network before cancelling");
  }
  if (pending.has(order.historyKey)) throw new Error("Cancellation is already pending");
  pending.add(order.historyKey);
  try {
    const request = client.getCancelOrderRequest(order);
    const hash = await walletClient.writeContract({
      address: request.contractAddress as Address,
      abi: request.abi as Abi,
      functionName: "cancel",
      args: request.args,
      account,
      chain: walletClient.chain,
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") throw new Error("Order cancellation reverted");
    await refreshOrders();
    return hash;
  } finally {
    pending.delete(order.historyKey);
  }
}`;
}

export const formatCancelOrderExampleCode = formatCancelOrderCode;

export function formatApproveTokenCode() {
  return formatAdvancedOrdersSdkStep("approve");
}

export function formatLiveApproveTokenCode() {
  return formatAdvancedOrdersSdkStep("approve");
}

export function formatLiveCheckApprovalCode() {
  return formatAdvancedOrdersSdkStep("check");
}

const ORDER_TYPES_FILE = {
  format: formatOrderTypesCode,
  name: "order-types.ts",
  syntaxLanguage: "typescript",
} as const;

export const SIGNATURE_EXAMPLE_CODE_SNIPPET: CodeSnippetOptions = {
  copyLabel: "Copy code",
  fileName: "sign-order.ts",
  format: () => formatAdvancedOrdersSdkStep("sign"),
  formatEdit: (data) => formatAdvancedOrdersSdkStep("sign", data),
  getFieldExplanation: getSignatureMessageFieldExplanation,
  inlineEditable: true,
  language: "TypeScript",
  syntaxLanguage: "typescript",
};

export const CANCEL_CODE_SNIPPET: CodeSnippetOptions = {
  copyLabel: "Copy code",
  fileName: "cancel-order.ts",
  format: formatCancelOrderCode,
  language: "TypeScript",
  syntaxLanguage: "typescript",
};

export const CANCEL_EXAMPLE_CODE_SNIPPET: CodeSnippetOptions = {
  copyLabel: "Copy code",
  fileName: "cancel-order.ts",
  format: formatCancelOrderExampleCode,
  language: "TypeScript",
  syntaxLanguage: "typescript",
};

export const APPROVE_TOKEN_CODE_SNIPPET: CodeSnippetOptions = {
  copyLabel: "Copy code",
  fileName: "approve-token.ts",
  format: () => formatAdvancedOrdersSdkStep("approve"),
  language: "TypeScript",
  syntaxLanguage: "typescript",
};

export const LIVE_APPROVE_TOKEN_CODE_SNIPPET: CodeSnippetOptions = {
  copyLabel: "Copy code",
  fileName: "approve-token.ts",
  format: () => formatAdvancedOrdersSdkStep("approve"),
  language: "TypeScript",
  syntaxLanguage: "typescript",
};

export const LIVE_CHECK_APPROVAL_CODE_SNIPPET: CodeSnippetOptions = {
  copyLabel: "Copy code",
  fileName: "check-approval.ts",
  format: () => formatAdvancedOrdersSdkStep("check"),
  language: "TypeScript",
  syntaxLanguage: "typescript",
};

export const LIVE_WRAP_NATIVE_TOKEN_CODE_SNIPPET: CodeSnippetOptions = {
  copyLabel: "Copy code",
  fileName: "wrap-native-token.ts",
  format: () => formatAdvancedOrdersSdkStep("wrap"),
  language: "TypeScript",
  syntaxLanguage: "typescript",
};

export const LIVE_CREATE_ORDER_CODE_SNIPPET: CodeSnippetOptions = {
  copyLabel: "Copy code",
  fileName: "sign-order.ts",
  format: () => formatAdvancedOrdersSdkStep("sign"),
  formatEdit: (data) => formatAdvancedOrdersSdkStep("sign", data),
  getFieldExplanation: getSignatureMessageFieldExplanation,
  inlineEditable: true,
  language: "TypeScript",
  syntaxLanguage: "typescript",
};

export const FULL_ORDER_FLOW_CODE_SNIPPET = ADVANCED_ORDERS_SDK_FLOW;

export const CREATE_ORDER_CODE_SNIPPET: CodeSnippetOptions = {
  copyLabel: "Copy code",
  fileName: "submit-order.ts",
  format: (data) => formatAdvancedOrdersSdkStep("submit", data),
  language: "TypeScript",
  syntaxLanguage: "typescript",
};

export const CREATED_ORDER_CODE_SNIPPET: CodeSnippetOptions = {
  copyLabel: "Copy order",
  fileName: "created-order.ts",
  format: formatCreatedOrderCode,
  getFieldExplanation: getCreatedOrderFieldExplanation,
  language: "TypeScript",
  syntaxLanguage: "typescript",
};

export const FETCH_ORDERS_CODE_SNIPPET: CodeSnippetOptions = {
  copyLabel: "Copy code",
  fileName: "fetch-orders.ts",
  format: formatFetchOrdersCode,
  language: "TypeScript",
  syntaxLanguage: "typescript",
};

export const PERMIT_DATA_CODE_SNIPPET: CodeSnippetOptions = {
  copyLabel: "Copy code",
  fileName: "fetch-permit-data.ts",
  files: [ORDER_TYPES_FILE],
  format: formatPermitDataFetchCode,
  hideStatusLabel: true,
  language: "TypeScript",
  syntaxLanguage: "typescript",
};

export const SIGNATURE_EXAMPLE_DATA = {
  partner: "external",
  message: {
    permitted: {
      token: "0x1111111111111111111111111111111111111111",
      amount: "1000000000000000000",
    },
    spender: "0x2222222222222222222222222222222222222222",
    nonce: "1788217200123",
    deadline: "1788220800",
    witness: {
      reactor: "0x3333333333333333333333333333333333333333",
      executor: "0x4444444444444444444444444444444444444444",
      exchange: {
        adapter: "0x8888888888888888888888888888888888888888",
        ref: "0x9999999999999999999999999999999999999999",
        share: 0,
        data: "0x",
      },
      swapper: "0x5555555555555555555555555555555555555555",
      nonce: "1788217200123",
      start: "1788217200",
      deadline: "1788220800",
      chainid: 137,
      exclusivity: 0,
      epoch: 300,
      slippage: 100,
      freshness: 60,
      input: {
        token: "0x1111111111111111111111111111111111111111",
        amount: "100000000000000000",
        maxAmount: "1000000000000000000",
      },
      output: {
        token: "0x6666666666666666666666666666666666666666",
        limit: "250000000",
        triggerLower: "0",
        triggerUpper: "0",
        recipient: "0x5555555555555555555555555555555555555555",
      },
    },
  },
  domain: {
    name: "RePermit",
    version: "1",
    chainId: 137,
    verifyingContract: "0x7777777777777777777777777777777777777777",
  },
  primaryType: "RePermitWitnessTransferFrom",
  types: {
    RePermitWitnessTransferFrom: [
      { name: "permitted", type: "TokenPermissions" },
      { name: "spender", type: "address" },
      { name: "nonce", type: "uint256" },
      { name: "deadline", type: "uint256" },
      { name: "witness", type: "Order" },
    ],
    TokenPermissions: [
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    Exchange: [
      { name: "adapter", type: "address" },
      { name: "ref", type: "address" },
      { name: "share", type: "uint32" },
      { name: "data", type: "bytes" },
    ],
    Order: [
      { name: "reactor", type: "address" },
      { name: "executor", type: "address" },
      { name: "exchange", type: "Exchange" },
      { name: "swapper", type: "address" },
      { name: "nonce", type: "uint256" },
      { name: "start", type: "uint256" },
      { name: "deadline", type: "uint256" },
      { name: "chainid", type: "uint256" },
      { name: "exclusivity", type: "uint32" },
      { name: "epoch", type: "uint32" },
      { name: "slippage", type: "uint32" },
      { name: "freshness", type: "uint32" },
      { name: "input", type: "Input" },
      { name: "output", type: "Output" },
    ],
    Input: [
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "maxAmount", type: "uint256" },
    ],
    Output: [
      { name: "token", type: "address" },
      { name: "limit", type: "uint256" },
      { name: "triggerLower", type: "uint256" },
      { name: "triggerUpper", type: "uint256" },
      { name: "recipient", type: "address" },
    ],
  },
  account: "0x5555555555555555555555555555555555555555",
} satisfies JsonContainer;

export const CREATE_ORDER_EXAMPLE_DATA = {
  signature:
    "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc1b",
  order: SIGNATURE_EXAMPLE_DATA.message,
  status: "pending",
} satisfies JsonContainer;

export const CREATE_ORDER_EXAMPLE_URL =
  "https://order-sink-v2.orbs.network/orders/new";

export const PERMIT_DATA_REQUEST_DATA = {
  endpoint: "https://order-sink-v2.orbs.network/config",
  partner: "external",
  chain: 137,
} satisfies JsonContainer;

export const PERMIT_DATA_REQUEST_URL =
  "https://order-sink-v2.orbs.network/config?partner=external&chain=137";

export const PERMIT_DATA_RESPONSE = {
  domain: {
    chainId: 137,
    name: "RePermit",
    verifyingContract: "0x7777777777777777777777777777777777777777",
    version: "1",
  },
  order: {
    permitted: {
      token: "0x0000000000000000000000000000000000000000",
      amount: "0",
    },
    spender: "0x2222222222222222222222222222222222222222",
    nonce: "0",
    deadline: "0",
    witness: {
      reactor: "0x3333333333333333333333333333333333333333",
      executor: "0x4444444444444444444444444444444444444444",
      exchange: {
        adapter: "0x8888888888888888888888888888888888888888",
        ref: "0x9999999999999999999999999999999999999999",
        share: 0,
        data: "0x",
      },
      swapper: "0x0000000000000000000000000000000000000000",
      nonce: "0",
      start: "0",
      deadline: "0",
      chainid: 137,
      exclusivity: 0,
      epoch: 0,
      slippage: 0,
      freshness: 0,
      input: {
        token: "0x0000000000000000000000000000000000000000",
        amount: "0",
        maxAmount: "0",
      },
      output: {
        token: "0x0000000000000000000000000000000000000000",
        limit: "0",
        triggerLower: "0",
        triggerUpper: "0",
        recipient: "0x0000000000000000000000000000000000000000",
      },
    },
  },
  partner: "external",
  primaryType: "RePermitWitnessTransferFrom",
  types: {
    Exchange: [
      { name: "adapter", type: "address" },
      { name: "ref", type: "address" },
      { name: "share", type: "uint32" },
      { name: "data", type: "bytes" },
    ],
    Input: [
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "maxAmount", type: "uint256" },
    ],
    Order: [
      { name: "reactor", type: "address" },
      { name: "executor", type: "address" },
      { name: "exchange", type: "Exchange" },
      { name: "swapper", type: "address" },
      { name: "nonce", type: "uint256" },
      { name: "start", type: "uint256" },
      { name: "deadline", type: "uint256" },
      { name: "chainid", type: "uint256" },
      { name: "exclusivity", type: "uint32" },
      { name: "epoch", type: "uint32" },
      { name: "slippage", type: "uint32" },
      { name: "freshness", type: "uint32" },
      { name: "input", type: "Input" },
      { name: "output", type: "Output" },
    ],
    Output: [
      { name: "token", type: "address" },
      { name: "limit", type: "uint256" },
      { name: "triggerLower", type: "uint256" },
      { name: "triggerUpper", type: "uint256" },
      { name: "recipient", type: "address" },
    ],
    RePermitWitnessTransferFrom: [
      { name: "permitted", type: "TokenPermissions" },
      { name: "spender", type: "address" },
      { name: "nonce", type: "uint256" },
      { name: "deadline", type: "uint256" },
      { name: "witness", type: "Order" },
    ],
    TokenPermissions: [
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
    ],
  },
} satisfies JsonContainer;

export const CANCEL_EXAMPLE_DATA = {
  abi: "function cancel(bytes32[] digests)",
  functionName: "cancel",
  address: "0x7777777777777777777777777777777777777777",
  args: [
    [
      "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    ],
  ],
  chain: 137,
  account: "0x5555555555555555555555555555555555555555",
} satisfies JsonContainer;

export const APPROVE_TOKEN_EXAMPLE_DATA = {
  tokenAddress: "0x1111111111111111111111111111111111111111",
  spender: "0x7777777777777777777777777777777777777777",
  amount: "1000000000000000000",
  account: "0x5555555555555555555555555555555555555555",
  chainId: 137,
} satisfies JsonContainer;

export const FETCH_ORDERS_EXAMPLE_DATA = {
  method: "GET",
  endpoint: "https://order-sink-v2.orbs.network/orders",
  query: {
    swapper: "0x5555555555555555555555555555555555555555",
    chainId: 137,
    exchange: "0x8888888888888888888888888888888888888888",
  },
} satisfies JsonContainer;

export const FETCH_ORDERS_EXAMPLE_RESPONSE_DATA = {
  orders: [
    {
      hash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      metadata: {
        chunks: [],
        expectedChunks: 10,
        lastPriceCheck: "2026-08-23T09:00:00.000Z",
        nextEligibleTime: "2026-08-23T10:00:00.000Z",
        status: "pending",
        description: "TWAP market order",
        displayOnlyInputTokenPriceUSD: "2500000000000000000000",
        repermitDigest:
          "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      },
      order: SIGNATURE_EXAMPLE_DATA.message,
      signature: CREATE_ORDER_EXAMPLE_DATA.signature,
      timestamp: "2026-08-23T09:00:00.000Z",
    },
  ],
  page: 1,
  limit: 50,
  total: 1,
  totalPages: 1,
} satisfies JsonContainer;

export const CREATE_ORDER_EXAMPLE_RESPONSE_DATA = {
  success: true,
  signedOrder: FETCH_ORDERS_EXAMPLE_RESPONSE_DATA.orders[0],
} satisfies JsonContainer;

export const FETCH_ORDERS_EXAMPLE_URL =
  "https://order-sink-v2.orbs.network/orders?swapper=0x5555555555555555555555555555555555555555&chainId=137&exchange=0x8888888888888888888888888888888888888888";
