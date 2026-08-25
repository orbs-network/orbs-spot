import type {
  CodeSnippetOptions,
  JsonContainer,
  JsonPrimitive,
  JsonValue,
  JsonValuePath,
} from "./json-inspector";

const CANCEL_ABI_PLACEHOLDER = "__CANCEL_ABI__";
const CANCEL_ADDRESS_PLACEHOLDER = "__CANCEL_ADDRESS__";
const CANCEL_CHAIN_PLACEHOLDER = "__CANCEL_CHAIN__";
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
    "The contract allowed to spend the permitted source tokens.",
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
  "message.witness.output.stop":
    "The stop threshold used by order variants that define a single stop value.",
  "message.witness.output.triggerLower":
    "The lower trigger threshold. It is populated for stop-loss orders and otherwise set to zero.",
  "message.witness.output.triggerUpper":
    "The upper trigger threshold. It is populated for take-profit orders and otherwise set to zero.",
  "message.witness.output.recipient":
    "The wallet that receives destination tokens from completed fills.",
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
    "The input token's USD price stored for display purposes.",
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

// ECDSA signature parts expected by POST /orders/new.
export type Signature = {
  // Recovery identifier encoded as hex (normally 0x1b or 0x1c).
  v: \`0x\${string}\`;
  // First 32-byte signature scalar.
  r: \`0x\${string}\`;
  // Second 32-byte signature scalar.
  s: \`0x\${string}\`;
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
  // Approval/execution spender returned by GET /config.
  spender: Address;
  // Fresh application-generated permit nonce used to prevent replay.
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
      // Referral share in basis points.
      share: number;
      // Optional adapter-specific calldata; use 0x when empty.
      data: Hex;
    };
    // Wallet that owns the input tokens and signs the typed data.
    swapper: Address;
    // Fresh order nonce; keep it synchronized with your nonce strategy.
    nonce: string;
    // Earliest Unix-second timestamp at which execution may begin.
    start?: string;
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
      // Optional stop value used by strategies that support it.
      stop?: string;
      // Optional lower trigger boundary.
      triggerLower?: string;
      // Optional upper trigger boundary.
      triggerUpper?: string;
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
  // Exchange adapter from the partner's GET /config response.
  exchange: Address;
};

// Response body returned by the order-history endpoint.
export type FetchOrdersResponse = {
  orders: OrderResponse[];
};`;
}

function getDexChainId(data: JsonContainer) {
  const root = Array.isArray(data) ? {} : data;
  const message =
    root.message &&
    typeof root.message === "object" &&
    !Array.isArray(root.message)
      ? root.message
      : {};
  const witness =
    message.witness &&
    typeof message.witness === "object" &&
    !Array.isArray(message.witness)
      ? message.witness
      : {};
  const domain =
    root.domain &&
    typeof root.domain === "object" &&
    !Array.isArray(root.domain)
      ? root.domain
      : {};
  const chainIdValue =
    typeof root.chainId === "number" || typeof root.chainId === "string"
      ? root.chainId
      : typeof witness.chainid === "number" ||
          typeof witness.chainid === "string"
        ? witness.chainid
        : typeof domain.chainId === "number" ||
            typeof domain.chainId === "string"
          ? domain.chainId
          : 137;
  const parsedChainId = Number(chainIdValue);

  return Number.isFinite(parsedChainId) ? parsedChainId : 137;
}

function formatSignTypedDataArgs(data: JsonContainer) {
  const root = Array.isArray(data) ? {} : data;
  const signTypedDataArgs = {
    message:
      root.message && typeof root.message === "object"
        ? root.message
        : {},
    domain:
      root.domain && typeof root.domain === "object"
        ? root.domain
        : {},
    primaryType: root.primaryType ?? "",
    types:
      root.types && typeof root.types === "object" ? root.types : {},
    ...(root.account !== undefined ? { account: root.account } : {}),
  } satisfies JsonContainer;
  const baseDataExpressions: Record<string, string> = {
    account: "account",
    domain: "configResponse.domain",
    primaryType: "configResponse.primaryType",
    types: "configResponse.types",
    "message.witness.swapper": "account",
  };
  const configSourceComments: Record<string, string> = {
    "message.spender": "configResponse.order.spender",
    "message.witness.reactor": "configResponse.order.witness.reactor",
    "message.witness.executor": "configResponse.order.witness.executor",
    "message.witness.exchange.adapter":
      "configResponse.order.witness.exchange.adapter",
    "message.witness.exchange.ref":
      "configResponse.order.witness.exchange.ref",
    "message.witness.exchange.share":
      "configResponse.order.witness.exchange.share",
    "message.witness.exchange.data":
      "configResponse.order.witness.exchange.data",
    "message.witness.exclusivity":
      "configResponse.order.witness.exclusivity",
    "message.witness.output.stop":
      "configResponse.order.witness.output.stop",
  };

  return serializeTypeScriptValue(
    signTypedDataArgs,
    (path) => baseDataExpressions[path.join(".")],
    [],
    0,
    (path) => configSourceComments[path.join(".")],
  );
}

function getPermitConfigExampleParams(data: JsonContainer) {
  const root = Array.isArray(data) ? {} : data;
  const domain =
    root.domain && typeof root.domain === "object" && !Array.isArray(root.domain)
      ? root.domain
      : {};
  const partner =
    typeof root.partner === "string" ? root.partner : "unknown";
  const query =
    root.query && typeof root.query === "object" && !Array.isArray(root.query)
      ? root.query
      : {};
  const chain =
    typeof domain.chainId === "number" || typeof domain.chainId === "string"
      ? domain.chainId
      : typeof root.chainId === "number" || typeof root.chainId === "string"
        ? root.chainId
        : typeof root.chain === "number" || typeof root.chain === "string"
          ? root.chain
          : typeof query.chainId === "number" ||
              typeof query.chainId === "string"
            ? query.chainId
            : 137;
  return { chain, partner };
}

export function formatSignOrderExampleCode(data: JsonContainer) {
  const { partner } = getPermitConfigExampleParams(data);
  const chainId = getDexChainId(data);
  const serializedArgs = formatSignTypedDataArgs(data);

  return `import { useCallback } from "react";
import { parseSignature, toHex } from "viem";
import { useConnection, useSignTypedData } from "wagmi";
import type { PermitData, Signature } from "./order-types";

// Hooks stay inside a custom hook so this file follows React's Rules of Hooks.
export function useSignOrder() {
  const { address: account } = useConnection();
  const { signTypedDataAsync } = useSignTypedData();

  return useCallback(async () => {
    // Fetch trusted contract fields and layer in fresh form/quote values.
    // Replace the sample amounts, nonces, and timestamps shown below.
    const configRequest = await fetch(
      ${JSON.stringify(`https://order-sink-v2.orbs.network/config?partner=${partner}&chain=${chainId}`)},
      { headers: { Accept: "application/json" } },
    );
    if (!configRequest.ok) {
      throw new Error(\`Failed to fetch permit config (\${configRequest.status})\`);
    }
    const configResponse = (await configRequest.json()) as PermitData;
    if (configResponse.domain.chainId !== ${JSON.stringify(chainId)}) {
      throw new Error("DEX and config chain IDs must match");
    }
    const signTypedDataArgs = ${serializedArgs} as const;
    const order = signTypedDataArgs.message;
    const signatureHex = await signTypedDataAsync(signTypedDataArgs);
    const parsedSignature = parseSignature(signatureHex);
    const signature: Signature = {
      v: toHex(
        parsedSignature.v ??
          BigInt((parsedSignature.yParity ?? 0) + 27),
      ),
      r: parsedSignature.r,
      s: parsedSignature.s,
    };

    // Preserve the exact object that was signed for POST /orders/new.
    return { signature, order };
  }, [account, signTypedDataAsync]);
}`;
}

export function formatFullOrderFlowCode(data: JsonContainer) {
  const root = Array.isArray(data) ? {} : data;
  const partner =
    typeof root.partner === "string" ? root.partner : "unknown";
  const chainId = getDexChainId(data);
  const sourceTokenAddress =
    typeof root.sourceTokenAddress === "string"
      ? root.sourceTokenAddress
      : !Array.isArray(root.message) &&
          root.message &&
          typeof root.message === "object" &&
          root.message.permitted &&
          typeof root.message.permitted === "object" &&
          !Array.isArray(root.message.permitted) &&
          typeof root.message.permitted.token === "string"
        ? root.message.permitted.token
        : "0x0000000000000000000000000000000000000000";
  const serializedArgs = formatSignTypedDataArgs(data);

  return `// Complete client-side Orders Sink integration.
//
// Flow: trusted config -> one local order -> token preparation -> EIP-712
// signature -> submit the exact signed object. Replace sample literals with
// current form, quote, wallet, nonce, and timestamp values from your app.
import { useCallback } from "react";
import { erc20Abi, maxUint256, parseAbi, parseSignature, toHex, zeroAddress } from "viem";
import { useConnection, usePublicClient, useSignTypedData, useWalletClient } from "wagmi";
import type { CreateOrderResponse, OrderResponse, PermitData, PermitOrder, Signature, SignedOrder } from "./order-types";

// Keep this service origin fixed. Do not let users override the config source.
const ORDERS_SINK_URL = "https://order-sink-v2.orbs.network";
// WToken contracts expose deposit() for converting native currency to ERC-20.
const wrappedNativeAbi = parseAbi(["function deposit() payable"]);

// Submit only after the wallet has signed the exact order argument.
async function createOrder(
  signature: Signature,
  order: PermitOrder,
): Promise<OrderResponse> {
  // Orders Sink expects the decomposed signature, original message, and the
  // initial pending status in one JSON request body.
  const body: SignedOrder = { signature, order, status: "pending" };
  const response = await fetch(\`${"${ORDERS_SINK_URL}"}/orders/new\`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  // The API may return a useful JSON error even for a non-2xx response.
  const result = (await response.json().catch(() => ({}))) as CreateOrderResponse;

  // HTTP failures indicate transport/auth/routing problems.
  if (!response.ok) {
    throw new Error(\`Request failed (${"${response.status}"})\`);
  }
  // A successful HTTP response can still contain a domain-level API failure.
  if (!result.success) {
    throw new Error(result.message ?? "Order creation failed");
  }

  // Return the server record so the UI can display or track the new order.
  return result.signedOrder;
}

// One hook owns the complete flow so every step uses the same wallet, chain,
// config response, and order object.
export function useSubmitOrdersSinkOrder() {
  // The connected address becomes swapper, recipient, and signing account in
  // this sample. Change recipient only when your product explicitly supports it.
  const { address: account } = useConnection();
  // Public client performs reads and waits for transaction confirmations.
  const publicClient = usePublicClient();
  // Wallet client sends wrap/approval transactions on the active chain.
  const { data: walletClient } = useWalletClient();
  // signTypedDataAsync requests an off-chain EIP-712 wallet signature.
  const { signTypedDataAsync } = useSignTypedData();

  return useCallback(async () => {
    // Stop before reading config or constructing an order without wallet state.
    if (!account || !publicClient || !walletClient) {
      throw new Error("Connect a wallet before creating an order");
    }

    // 1. GET /config from the trusted Orders Sink endpoint using the DEX-owned
    // partner and chain values inlined below.
    // The response is a security boundary: it supplies the EIP-712 domain,
    // spender, protocol contracts, exchange adapter, primary type, and type map.
    const configRequest = await fetch(
      ${JSON.stringify(`https://order-sink-v2.orbs.network/config?partner=${partner}&chain=${chainId}`)},
      { headers: { Accept: "application/json" } },
    );
    if (!configRequest.ok) {
      throw new Error(
        \`Failed to fetch permit config (${"${configRequest.status}"})\`,
      );
    }
    // Keep this response unchanged and layer only application-owned values into
    // signTypedDataArgs below.
    const configResponse = (await configRequest.json()) as PermitData;

    // 2. Build the order once. Replace sample literals with fresh form/quote
    // values from the DEX-derived form/quote state, then never rebuild this
    // object between signing and submit.
    // Amounts use token base units, timestamps use Unix seconds, and slippage /
    // fee shares use basis points.
    //
    // Field ownership summary:
    // - configResponse: domain, primaryType, types, spender, reactor, executor,
    //   exchange adapter/ref/share/data, exclusivity, and default stop behavior.
    // - Connected wallet: account, swapper, and normally output.recipient.
    // - DEX state: chainId, tokenAddress, inputTokenAddress, requiredAmount,
    //   quote amounts, output limits, and strategy trigger values.
    // - Application state: nonces, start/deadline, epoch, slippage, freshness,
    //   recipient overrides, and any product-specific constraints.
    const signTypedDataArgs = ${serializedArgs} as const;
    // This message object is the single source of truth for all later steps.
    const order = signTypedDataArgs.message;
    // Always approve the verifying contract returned by trusted config.
    const spender = configResponse.domain.verifyingContract;

    // Never let wallet state or fetched config silently replace the DEX chain.
    if (
      walletClient.chain.id !== order.witness.chainid ||
      configResponse.domain.chainId !== order.witness.chainid
    ) {
      throw new Error("DEX, wallet, domain, and order chain IDs must match");
    }

    // 3. Read allowance without prompting the wallet.
    // This read determines whether an approval transaction is necessary.
    const allowance = await publicClient.readContract({
      address: order.permitted.token,
      abi: erc20Abi,
      functionName: "allowance",
      args: [account, spender],
    });

    // 4. Orders Sink does not support native input. If native was selected,
    // wrap it first; both order token fields must already contain WToken.
    // The inlined source address is the raw UI selection, while both token
    // fields below are the DEX-derived ERC-20 addresses written into the order.
    if (${JSON.stringify(sourceTokenAddress)}.toLowerCase() === zeroAddress) {
      // Reject a malformed native-input order before sending any transaction.
      if (
        order.permitted.token.toLowerCase() === zeroAddress ||
        order.witness.input.token.toLowerCase() !==
          order.permitted.token.toLowerCase()
      ) {
        throw new Error(
          "Native input must use WToken for permitted.token and witness.input.token",
        );
      }

      // deposit() converts native currency to WToken owned by account.
      const wrapHash = await walletClient.writeContract({
        address: order.permitted.token,
        abi: wrappedNativeAbi,
        functionName: "deposit",
        value: BigInt(order.permitted.amount),
        account,
        chain: walletClient.chain,
      });
      // Do not continue until the wrapped balance is available on-chain.
      await publicClient.waitForTransactionReceipt({ hash: wrapHash });
    }

    // 5. Approve only when the current allowance is insufficient.
    // maxUint256 avoids repeated approvals; use order.permitted.amount instead
    // if your product's approval policy requires exact allowances.
    if (allowance < BigInt(order.permitted.amount)) {
      const approveHash = await walletClient.writeContract({
        address: order.permitted.token,
        abi: erc20Abi,
        functionName: "approve",
        args: [spender, maxUint256],
        account,
        chain: walletClient.chain,
      });
      // Signing before confirmation could produce an order that cannot execute.
      await publicClient.waitForTransactionReceipt({ hash: approveHash });
    }

    // 6. Sign the exact order object created above.
    // EIP-712 signing is not an on-chain transaction and spends no gas.
    const signatureHex = await signTypedDataAsync(signTypedDataArgs);
    // Orders Sink expects v/r/s fields instead of one concatenated hex value.
    const parsedSignature = parseSignature(signatureHex);
    const signature: Signature = {
      v: toHex(
        parsedSignature.v ??
          BigInt((parsedSignature.yParity ?? 0) + 27),
      ),
      r: parsedSignature.r,
      s: parsedSignature.s,
    };

    // 7. POST that same order object to Orders Sink.
    // Never reconstruct or normalize order here: any byte-level change can make
    // the signature invalid.
    return await createOrder(signature, order);
  }, [account, publicClient, signTypedDataAsync, walletClient]);
}`;
}

export function formatWrapNativeTokenCode() {
  return `import { useCallback } from "react";
import { parseAbi } from "viem";
import {
  useConnection,
  usePublicClient,
  useWalletClient,
} from "wagmi";

import type { Address } from "./order-types";

// The wrapped-native contract exposes a payable deposit() function.
const wrappedNativeAbi = parseAbi(["function deposit() payable"]);

export function useWrapNativeTokenExample() {
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { address: account } = useConnection();

  return useCallback(async (amount: string, tokenAddress: Address) => {
    if (!account || !publicClient || !walletClient) {
      throw new Error("Connect a wallet before wrapping");
    }

    const hash = await walletClient.writeContract({
      address: tokenAddress,
      abi: wrappedNativeAbi,
      functionName: "deposit",
      value: BigInt(amount),
      account,
      chain: walletClient.chain,
    });

    // Wait until the wrapped balance is available for the next step.
    await publicClient.waitForTransactionReceipt({ hash });
    return hash;
  }, [account, publicClient, walletClient]);
}`;
}

export function formatLiveWrapNativeTokenCode(data: JsonContainer) {
  const amount =
    !Array.isArray(data) && typeof data.amount === "string"
      ? data.amount
      : "0";
  const tokenAddress =
    !Array.isArray(data) && typeof data.tokenAddress === "string"
      ? data.tokenAddress
      : "0x0000000000000000000000000000000000000000";
  return `${formatWrapNativeTokenCode()}

// This hook exposes the current live order as an event-safe callback.
export function useWrapCurrentOrderToken() {
  const wrapNativeToken = useWrapNativeTokenExample();

  return useCallback(
    () => wrapNativeToken(
      ${JSON.stringify(amount)},
      ${JSON.stringify(tokenAddress)},
    ),
    [wrapNativeToken],
  );
}`;
}

export function formatCreateOrderFetchCode() {
  return `import type {
  CreateOrderResponse,
  PermitOrder,
  Signature,
  SignedOrder,
} from "./order-types";

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

function formatSubmitSignedOrderCode(data: JsonContainer) {
  if (Array.isArray(data)) return JSON.stringify(data, null, 2);

  const bodySourceComments: Record<string, string> = {
    signature: "Wallet: v, r, and s parsed from the EIP-712 signature.",
    "signature.v": "Wallet signature: parsed recovery identifier.",
    "signature.r": "Wallet signature: parsed first ECDSA scalar.",
    "signature.s": "Wallet signature: parsed second ECDSA scalar.",
    order: "Exact message object signed in the previous step.",
    "order.permitted.token":
      "DEX state: ERC-20 input token; use WToken when native input was selected.",
    "order.permitted.amount":
      "DEX state: total required input amount in token base units.",
    "order.spender": "configResponse.order.spender.",
    "order.nonce": "Application: fresh permit nonce generated for this order.",
    "order.deadline":
      "Application: permit expiration timestamp in Unix seconds.",
    "order.witness.reactor": "configResponse.order.witness.reactor.",
    "order.witness.executor": "configResponse.order.witness.executor.",
    "order.witness.exchange.adapter":
      "configResponse.order.witness.exchange.adapter.",
    "order.witness.exchange.ref":
      "configResponse.order.witness.exchange.ref.",
    "order.witness.exchange.share":
      "configResponse.order.witness.exchange.share.",
    "order.witness.exchange.data":
      "configResponse.order.witness.exchange.data.",
    "order.witness.swapper": "Connected wallet address.",
    "order.witness.nonce":
      "Application: fresh witness nonce generated for this order.",
    "order.witness.start":
      "Application: earliest execution timestamp in Unix seconds.",
    "order.witness.deadline":
      "Application: order expiration timestamp in Unix seconds.",
    "order.witness.chainid": "DEX state: selected EVM chain ID.",
    "order.witness.exclusivity":
      "configResponse.order.witness.exclusivity.",
    "order.witness.epoch":
      "Application order settings: interval between eligible fills.",
    "order.witness.slippage":
      "Application order settings: allowed slippage in basis points.",
    "order.witness.freshness":
      "Application order settings: maximum execution-data age.",
    "order.witness.input.token":
      "DEX state: ERC-20 input token; must match permitted.token.",
    "order.witness.input.amount":
      "DEX calculation: input amount allocated to each fill.",
    "order.witness.input.maxAmount":
      "DEX calculation: maximum total input available to the order.",
    "order.witness.output.token": "DEX state: selected destination token.",
    "order.witness.output.limit":
      "DEX quote: minimum destination amount accepted per fill.",
    "order.witness.output.stop":
      "configResponse.order.witness.output.stop.",
    "order.witness.output.triggerLower":
      "Application strategy form: lower execution trigger.",
    "order.witness.output.triggerUpper":
      "Application strategy form: upper execution trigger.",
    "order.witness.output.recipient":
      "Connected wallet, unless the application selected another recipient.",
    status: 'Fixed POST /orders/new value: new orders start as "pending".',
  };
  const serializedBody = serializeTypeScriptValue(
    data,
    () => undefined,
    [],
    2,
    (path) => bodySourceComments[path.join(".")],
  );

  return `import type { CreateOrderResponse, SignedOrder } from "./order-types";

export async function createOrder() {
  // Submit the exact signature and order shown in this live flow.
  const body: SignedOrder = ${serializedBody};

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

export function formatLiveCreateOrderCode(data: JsonContainer) {
  const { partner } = getPermitConfigExampleParams(data);
  const chainId = getDexChainId(data);
  const serializedArgs = formatSignTypedDataArgs(data);

  return `import { useCallback } from "react";
import { parseSignature, toHex } from "viem";
import { useConnection, useSignTypedData } from "wagmi";
import { createOrder } from "./create-order";
import type { PermitData, Signature } from "./order-types";

export function useSignAndCreateOrder() {
  const { address: account } = useConnection();
  const { signTypedDataAsync } = useSignTypedData();

  return useCallback(async () => {
    // Build one order object and reuse it for both operations.
    const configRequest = await fetch(
      ${JSON.stringify(`https://order-sink-v2.orbs.network/config?partner=${partner}&chain=${chainId}`)},
      { headers: { Accept: "application/json" } },
    );
    if (!configRequest.ok) {
      throw new Error(\`Failed to fetch permit config (\${configRequest.status})\`);
    }
    const configResponse = (await configRequest.json()) as PermitData;
    if (configResponse.domain.chainId !== ${JSON.stringify(chainId)}) {
      throw new Error("DEX and config chain IDs must match");
    }
    const signTypedDataArgs = ${serializedArgs} as const;
    const order = signTypedDataArgs.message;

    const signatureHex = await signTypedDataAsync(signTypedDataArgs);
    const parsedSignature = parseSignature(signatureHex);
    const signature: Signature = {
      v: toHex(
        parsedSignature.v ??
          BigInt((parsedSignature.yParity ?? 0) + 27),
      ),
      r: parsedSignature.r,
      s: parsedSignature.s,
    };

    return await createOrder(signature, order);
  }, [account, signTypedDataAsync]);
}`;
}

export function formatFetchOrdersCode(data: JsonContainer) {
  if (Array.isArray(data)) return JSON.stringify(data, null, 2);

  const endpoint =
    typeof data.endpoint === "string"
      ? data.endpoint
      : "https://order-sink-v2.orbs.network/orders";
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
  const { partner } = getPermitConfigExampleParams(data);

  return `// Fetch the connected wallet's Orders Sink history.
// The exchange filter comes from trusted partner configuration so history is
// scoped to the same integration used when the orders were created.
import type { FetchOrdersResponse, PermitData } from "./order-types";

// Keep the Orders Sink origin fixed instead of accepting a user-provided host.
const ORDERS_SINK_URL = "https://order-sink-v2.orbs.network";
// Use the partner ID assigned by Orbs, or "unknown" when none was assigned.
const partner = ${JSON.stringify(partner)};

export const fetchOrders = async () => {
  // 1. Fetch trusted config for the same partner and chain as the history query.
  // The exchange adapter identifies which integration's orders to return.
  const configResponse = await fetch(
    \`\${ORDERS_SINK_URL}/config?partner=\${partner}&chain=${chainId}\`,
    { headers: { Accept: "application/json" } },
  );
  if (!configResponse.ok) {
    throw new Error(\`Failed to fetch permit config (\${configResponse.status})\`);
  }
  const basePermitData = (await configResponse.json()) as PermitData;

  // 2. Request orders for one wallet, chain, and configured exchange adapter.
  // swapper is the wallet that signed/owns the orders, not necessarily a token
  // recipient used by a custom integration.
  const response = await fetch(
    \`${endpoint}?swapper=${swapper}&chainId=${chainId}&exchange=\${basePermitData.order.witness.exchange.adapter}\`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
    },
  );

  // 3. Stop before parsing order data when the HTTP request failed.
  // Surface this error to the order-history UI or your monitoring layer.
  if (!response.ok) {
    throw new Error(\`Failed to fetch orders (\${response.status})\`);
  }

  // 4. Return only the array consumed by the order-history UI.
  // Each item includes the original message, signature, service metadata, and
  // repermitDigest required by the cancellation flow.
  const result = (await response.json()) as FetchOrdersResponse;
  return result.orders;
};`;
}

export function formatPermitConfigFetchCode(data: JsonContainer) {
  if (Array.isArray(data)) return JSON.stringify(data, null, 2);

  const endpoint =
    typeof data.endpoint === "string"
      ? data.endpoint
      : "https://order-sink-v2.orbs.network/config";
  const partner =
    typeof data.partner === "string" ? data.partner : "unknown";
  const chain =
    typeof data.chain === "string" || typeof data.chain === "number"
      ? data.chain
      : 137;

  return `import type { PermitData } from "./order-types";

// Use your Orbs partner ID. If you do not have one, set partner to "unknown".
const partner = ${JSON.stringify(partner)};
const chain = ${JSON.stringify(chain)};

export const fetchPermitConfig = async (): Promise<PermitData> => {
  // Security boundary: keep this trusted endpoint fixed in your application.
  // Fetch the unchanged base permit data for this partner and chain.
  const response = await fetch(
    \`${endpoint}?partner=\${partner}&chain=\${chain}\`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
    },
  );

  // Do not use base permit data returned by a failed request.
  if (!response.ok) {
    throw new Error(\`Failed to fetch permit config (\${response.status})\`);
  }

  // Return the base data; populate its calculated values before signing.
  const basePermitData = (await response.json()) as PermitData;
  return basePermitData;
};`;
}

export function formatCancelOrderCode(data: JsonContainer) {
  if (Array.isArray(data)) return JSON.stringify(data, null, 2);

  const abi = typeof data.abi === "string" ? data.abi : "";
  const isLegacyOrder = abi.includes("uint64");
  const chainId = typeof data.chain === "number" ? data.chain : 0;
  const partner = typeof data.partner === "string" ? data.partner : "unknown";
  const writeContractArgs = {
    abi: CANCEL_ABI_PLACEHOLDER,
    functionName: data.functionName,
    address: isLegacyOrder ? data.address : CANCEL_ADDRESS_PLACEHOLDER,
    args: data.args,
    chain: CANCEL_CHAIN_PLACEHOLDER,
    account: data.account,
  };
  const fieldSourceComments: Record<string, string> = {
    abi: "Cancellation ABI selected from order.version.",
    functionName: 'Fixed contract method: "cancel".',
    address: isLegacyOrder
      ? "Legacy contract address from order.twapAddress."
      : "RePermit contract address from basePermitData.domain.verifyingContract.",
    args: isLegacyOrder
      ? "Legacy order ID from order.id."
      : "RePermit digest from order.metadata.repermitDigest.",
    chain: "Active wallet chain, which must match order.chainId.",
    account:
      "Connected account from useConnection().address, falling back to order.maker.",
  };
  const serializedArgs = JSON.stringify(writeContractArgs, null, 2)
    .replace(JSON.stringify(CANCEL_ABI_PLACEHOLDER), "cancelAbi")
    .replace(
      JSON.stringify(CANCEL_ADDRESS_PLACEHOLDER),
      "basePermitData.domain.verifyingContract",
    )
    .replace(JSON.stringify(CANCEL_CHAIN_PLACEHOLDER), "walletClient.chain")
    .replace(/^(\s*)"([A-Za-z_$][\w$]*)":/gm, "$1$2:")
    .replace(
      /^  (abi|functionName|address|args|chain|account):/gm,
      (_match, field: string) =>
        `  // ${fieldSourceComments[field]}\n  ${field}:`,
    )
    .replace(/\n/g, "\n    ");
  const configImport = isLegacyOrder
    ? ""
    : 'import type { PermitData } from "./order-types";\n';
  const configConstant = isLegacyOrder
    ? ""
    : `

// Keep the config origin fixed: it supplies the trusted RePermit contract.
const ORDERS_SINK_URL = "https://order-sink-v2.orbs.network";`;
  const fetchPermitData = isLegacyOrder
    ? ""
    : `

    // 1. Fetch the base permit data for this order's partner and chain.
    // The cancellation contract must come from this trusted configuration.
    const configResponse = await fetch(
      \`\${ORDERS_SINK_URL}/config?partner=${encodeURIComponent(partner)}&chain=${chainId}\`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
      },
    );
    if (!configResponse.ok) {
      throw new Error(\`Failed to fetch permit config (\${configResponse.status})\`);
    }
    const basePermitData = (await configResponse.json()) as PermitData;

    // Do not submit the cancellation on a different network.
    if (
      basePermitData.domain.chainId !== ${chainId} ||
      walletClient.chain.id !== ${chainId}
    ) {
      throw new Error("Order, wallet, and permit config chain IDs must match");
    }`;
  const submitStep = isLegacyOrder
    ? ""
    : "    // 2. Submit the selected order digest to RePermit.\n";

  return `${configImport}import { useCallback } from "react";
import { parseAbi } from "viem";
import { usePublicClient, useWalletClient } from "wagmi";

// Use the connected wallet and the cancellation ABI shown by the current order.
// The connected wallet should be on chain ${chainId} before submitting.
const cancelAbi = parseAbi([${JSON.stringify(abi)}]);${configConstant}

export function useCancelSelectedOrder() {
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  return useCallback(async () => {
    if (!publicClient || !walletClient) {
      throw new Error("Connect a wallet before cancelling");
    }${fetchPermitData}

${submitStep}    const hash = await walletClient.writeContract(${serializedArgs});

    // Wait for confirmation, then refresh order history to show its new status.
    await publicClient.waitForTransactionReceipt({ hash });
    return hash;
  }, [publicClient, walletClient]);
}`;
}

export function formatCancelOrderExampleCode(data: JsonContainer) {
  const { partner } = getPermitConfigExampleParams(data);

  return `// Cancel a RePermit order on-chain using the digest returned by Orders Sink.
// Cancellation prevents future fills but cannot reverse fills already executed.
import { useCallback } from "react";
import type { Hex, PermitData } from "./order-types";
import { parseAbi } from "viem";
import { useConnection, usePublicClient, useWalletClient } from "wagmi";

// Keep the config origin fixed because it supplies the cancellation contract.
const ORDERS_SINK_URL = "https://order-sink-v2.orbs.network";
// Use the same partner identity used to create and query the order.
const partner = ${JSON.stringify(partner)};
// RePermit accepts one or more order digests, hence the bytes32[] argument.
const cancelAbi = parseAbi(["function cancel(bytes32[] digests)"]);

export function useCancelOrderExample() {
  // account submits and pays gas for the cancellation transaction.
  const { address: account } = useConnection();
  // publicClient waits until cancellation is confirmed.
  const publicClient = usePublicClient();
  // walletClient sends the on-chain cancel transaction.
  const { data: walletClient } = useWalletClient();

  // Pass order.metadata.repermitDigest from the selected history item.
  return useCallback(async (repermitDigest: Hex) => {
    if (!account || !publicClient || !walletClient) {
      throw new Error("Connect a wallet before cancelling");
    }

    // 1. Resolve the trusted RePermit contract for the wallet's active chain.
    // Never accept this contract address from editable UI input.
    const configResponse = await fetch(
      \`\${ORDERS_SINK_URL}/config?partner=\${partner}&chain=\${walletClient.chain.id}\`,
      { headers: { Accept: "application/json" } },
    );
    if (!configResponse.ok) {
      throw new Error(\`Failed to fetch permit config (\${configResponse.status})\`);
    }
    const basePermitData = (await configResponse.json()) as PermitData;

    // Protect against submitting a digest to a contract on the wrong network.
    if (basePermitData.domain.chainId !== walletClient.chain.id) {
      throw new Error("Wallet and cancellation contract chain IDs must match");
    }

    // 2. Call cancel with an array containing the selected order's digest.
    const hash = await walletClient.writeContract({
      // verifyingContract is both the permit spender and cancellation contract.
      address: basePermitData.domain.verifyingContract,
      abi: cancelAbi,
      functionName: "cancel",
      args: [[repermitDigest]],
      account,
      chain: walletClient.chain,
    });

    // 3. Wait for confirmation before marking the order cancelled in the UI.
    // Refresh order history afterward to display the service's latest status.
    await publicClient.waitForTransactionReceipt({ hash });
    return hash;
  }, [account, publicClient, walletClient]);
}`;
}

export function formatApproveTokenCode(
  data: JsonContainer,
  includeUsage = true,
) {
  const amount =
    !Array.isArray(data) && typeof data.amount === "string"
      ? data.amount
      : "<required-amount>";
  const tokenAddress =
    !Array.isArray(data) && typeof data.tokenAddress === "string"
      ? data.tokenAddress
      : "0x0000000000000000000000000000000000000000";
  const spender =
    !Array.isArray(data) && typeof data.spender === "string"
      ? data.spender
      : "0x0000000000000000000000000000000000000000";
  const usage = includeUsage
    ? `

export function useApproveExample() {
  const { checkApproval, approveToken } = useTokenApproval();

  return useCallback(async () => {
    const approvalRequired = await checkApproval(
      ${JSON.stringify(amount)},
      ${JSON.stringify(tokenAddress)},
      ${JSON.stringify(spender)},
    );

    // Only request a wallet transaction when allowance is insufficient.
    if (approvalRequired) {
      return await approveToken(
        ${JSON.stringify(tokenAddress)},
        ${JSON.stringify(spender)},
      );
    }
  }, [approveToken, checkApproval]);
}`
    : "";

  return `import { useCallback } from "react";
import { erc20Abi, maxUint256 } from "viem";
import {
  useConnection,
  usePublicClient,
  useWalletClient,
} from "wagmi";

import type { Address } from "./order-types";

export function useTokenApproval() {
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { address: account } = useConnection();

  const checkApproval = useCallback(async (
    amount: string,
    tokenAddress: Address,
    spender: Address,
  ) => {
    if (!account || !publicClient) {
      throw new Error("Connect a wallet before checking allowance");
    }

    const allowance = await publicClient.readContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: "allowance",
      args: [account, spender],
    });

    return allowance < BigInt(amount);
  }, [account, publicClient]);

  const approveToken = useCallback(async (
    tokenAddress: Address,
    spender: Address,
  ) => {
    if (!account || !publicClient || !walletClient) {
      throw new Error("Connect a wallet before approving");
    }

    const hash = await walletClient.writeContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: "approve",
      args: [spender, maxUint256],
      account,
      chain: walletClient.chain,
    });

    await publicClient.waitForTransactionReceipt({ hash });
    return hash;
  }, [account, publicClient, walletClient]);

  return { approveToken, checkApproval };
}${usage}`;
}

export function formatLiveApproveTokenCode(data: JsonContainer) {
  const tokenAddress =
    !Array.isArray(data) && typeof data.tokenAddress === "string"
      ? data.tokenAddress
      : "0x0000000000000000000000000000000000000000";
  const spender =
    !Array.isArray(data) && typeof data.spender === "string"
      ? data.spender
      : "0x0000000000000000000000000000000000000000";

  return `${formatApproveTokenCode(data, false)}

// This callback is safe to call from a button or mutation handler.
export function useApproveCurrentOrder() {
  const { approveToken } = useTokenApproval();

  return useCallback(
    () => approveToken(
      ${JSON.stringify(tokenAddress)},
      ${JSON.stringify(spender)},
    ),
    [approveToken],
  );
}`;
}

export function formatLiveCheckApprovalCode(data: JsonContainer) {
  const amount =
    !Array.isArray(data) && typeof data.amount === "string"
      ? data.amount
      : "0";
  const tokenAddress =
    !Array.isArray(data) && typeof data.tokenAddress === "string"
      ? data.tokenAddress
      : "0x0000000000000000000000000000000000000000";
  const spender =
    !Array.isArray(data) && typeof data.spender === "string"
      ? data.spender
      : "0x0000000000000000000000000000000000000000";

  return `${formatApproveTokenCode(data, false)}

// Read allowance without opening the wallet or sending a transaction.
export function useCheckCurrentOrderApproval() {
  const { checkApproval } = useTokenApproval();

  return useCallback(
    () => checkApproval(
      ${JSON.stringify(amount)},
      ${JSON.stringify(tokenAddress)},
      ${JSON.stringify(spender)},
    ),
    [checkApproval],
  );
}`;
}

const ORDER_TYPES_FILE = {
  format: formatOrderTypesCode,
  name: "order-types.ts",
  syntaxLanguage: "typescript",
} as const;

const CREATE_ORDER_FILE = {
  format: formatCreateOrderFetchCode,
  name: "create-order.ts",
  syntaxLanguage: "typescript",
} as const;

export const SIGNATURE_EXAMPLE_CODE_SNIPPET: CodeSnippetOptions = {
  copyLabel: "Copy code",
  fileName: "sign-order.ts",
  files: [ORDER_TYPES_FILE],
  format: formatSignOrderExampleCode,
  getFieldExplanation: getSignatureFieldExplanation,
  inlineEditable: true,
  language: "TypeScript",
  syntaxLanguage: "typescript",
};

export const CANCEL_CODE_SNIPPET: CodeSnippetOptions = {
  copyLabel: "Copy code",
  fileName: "cancel-order.ts",
  files: [ORDER_TYPES_FILE],
  format: formatCancelOrderCode,
  language: "TypeScript",
  syntaxLanguage: "typescript",
};

export const CANCEL_EXAMPLE_CODE_SNIPPET: CodeSnippetOptions = {
  copyLabel: "Copy code",
  fileName: "cancel-order.ts",
  files: [ORDER_TYPES_FILE],
  format: formatCancelOrderExampleCode,
  language: "TypeScript",
  syntaxLanguage: "typescript",
};

export const APPROVE_TOKEN_CODE_SNIPPET: CodeSnippetOptions = {
  copyLabel: "Copy code",
  fileName: "approve-token.ts",
  files: [ORDER_TYPES_FILE],
  format: formatApproveTokenCode,
  language: "TypeScript",
  syntaxLanguage: "typescript",
};

export const LIVE_APPROVE_TOKEN_CODE_SNIPPET: CodeSnippetOptions = {
  copyLabel: "Copy code",
  fileName: "approve-token.ts",
  files: [ORDER_TYPES_FILE],
  format: formatLiveApproveTokenCode,
  language: "TypeScript",
  syntaxLanguage: "typescript",
};

export const LIVE_CHECK_APPROVAL_CODE_SNIPPET: CodeSnippetOptions = {
  copyLabel: "Copy code",
  fileName: "check-approval.ts",
  files: [ORDER_TYPES_FILE],
  format: formatLiveCheckApprovalCode,
  language: "TypeScript",
  syntaxLanguage: "typescript",
};

export const LIVE_WRAP_NATIVE_TOKEN_CODE_SNIPPET: CodeSnippetOptions = {
  copyLabel: "Copy code",
  fileName: "wrap-native-token.ts",
  files: [ORDER_TYPES_FILE],
  format: formatLiveWrapNativeTokenCode,
  language: "TypeScript",
  syntaxLanguage: "typescript",
};

export const LIVE_CREATE_ORDER_CODE_SNIPPET: CodeSnippetOptions = {
  copyLabel: "Copy code",
  fileName: "sign-and-create-order.ts",
  files: [CREATE_ORDER_FILE, ORDER_TYPES_FILE],
  format: formatLiveCreateOrderCode,
  getFieldExplanation: getSignatureFieldExplanation,
  inlineEditable: true,
  language: "TypeScript",
  syntaxLanguage: "typescript",
};

export const FULL_ORDER_FLOW_CODE_SNIPPET: CodeSnippetOptions = {
  copyLabel: "Copy code",
  fileName: "create-order-flow.ts",
  files: [ORDER_TYPES_FILE],
  format: formatFullOrderFlowCode,
  getFieldExplanation: getSignatureFieldExplanation,
  language: "TypeScript",
  syntaxLanguage: "typescript",
};

export const CREATE_ORDER_CODE_SNIPPET: CodeSnippetOptions = {
  copyLabel: "Copy code",
  fileName: "create-order.ts",
  files: [ORDER_TYPES_FILE],
  format: formatSubmitSignedOrderCode,
  getFieldExplanation: getPermitDataFieldExplanation,
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
  files: [ORDER_TYPES_FILE],
  format: formatFetchOrdersCode,
  language: "TypeScript",
  syntaxLanguage: "typescript",
};

export const PERMIT_CONFIG_CODE_SNIPPET: CodeSnippetOptions = {
  copyLabel: "Copy code",
  fileName: "permit-config.ts",
  files: [ORDER_TYPES_FILE],
  format: formatPermitConfigFetchCode,
  hideStatusLabel: true,
  language: "Request",
  syntaxLanguage: "typescript",
};

export const SIGNATURE_EXAMPLE_DATA = {
  partner: "unknown",
  message: {
    permitted: {
      token: "0x1111111111111111111111111111111111111111",
      amount: "1000000000000000000",
    },
    spender: "0x2222222222222222222222222222222222222222",
    nonce: "42",
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
      nonce: "42",
      start: "1788217200",
      deadline: "1788220800",
      chainid: 1,
      exclusivity: 0,
      epoch: 3600,
      slippage: 100,
      freshness: 300,
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
    chainId: 1,
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
  signature: {
    v: "0x1b",
    r: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    s: "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
  },
  order: SIGNATURE_EXAMPLE_DATA.message,
  status: "pending",
} satisfies JsonContainer;

export const CREATE_ORDER_EXAMPLE_URL =
  "https://order-sink-v2.orbs.network/orders/new";

export const PERMIT_CONFIG_REQUEST_DATA = {
  endpoint: "https://order-sink-v2.orbs.network/config",
  partner: "quickswap",
  chain: 137,
} satisfies JsonContainer;

export const PERMIT_CONFIG_REQUEST_URL =
  "https://order-sink-v2.orbs.network/config?partner=quickswap&chain=137";

export const BASE_PERMIT_DATA_RESPONSE = {
  domain: {
    chainId: 137,
    name: "RePermit",
    verifyingContract: "0x00002a9C4D9497df5Bd31768eC5d30eEf5405000",
    version: "1",
  },
  order: {
    permitted: {
      token: "0x0000000000000000000000000000000000000000",
      amount: "0",
    },
    spender: "0x000000b33fE4fB9d999Dd684F79b110731c3d000",
    nonce: "0",
    deadline: "0",
    witness: {
      reactor: "0x000000b33fE4fB9d999Dd684F79b110731c3d000",
      executor: "0x000642A0966d9bd49870D9519f76b5cf823f3000",
      exchange: {
        adapter: "0x727e1CbA41Ff1ff11C32fa43DAb499b4317A1b65",
        ref: "0x0000000000000000000000000000000000000000",
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
  partner: "QuickSwap",
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
  chain: 1,
  account: "0x5555555555555555555555555555555555555555",
} satisfies JsonContainer;

export const APPROVE_TOKEN_EXAMPLE_DATA = {
  tokenAddress: "0x1111111111111111111111111111111111111111",
  spender: "0x2222222222222222222222222222222222222222",
  amount: "1000000000000000000",
  account: "0x5555555555555555555555555555555555555555",
  chainId: 1,
} satisfies JsonContainer;

export const FETCH_ORDERS_EXAMPLE_DATA = {
  method: "GET",
  endpoint: "https://order-sink-v2.orbs.network/orders",
  query: {
    swapper: "0x5555555555555555555555555555555555555555",
    chainId: 1,
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
        displayOnlyInputTokenPriceUSD: "2500.00",
        repermitDigest:
          "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      },
      order: SIGNATURE_EXAMPLE_DATA.message,
      signature: CREATE_ORDER_EXAMPLE_DATA.signature,
      timestamp: "2026-08-23T09:00:00.000Z",
    },
  ],
} satisfies JsonContainer;

export const CREATE_ORDER_EXAMPLE_RESPONSE_DATA = {
  success: true,
  signedOrder: FETCH_ORDERS_EXAMPLE_RESPONSE_DATA.orders[0],
} satisfies JsonContainer;

export const FETCH_ORDERS_EXAMPLE_URL =
  "https://order-sink-v2.orbs.network/orders?swapper=0x5555555555555555555555555555555555555555&chainId=1&exchange=0x8888888888888888888888888888888888888888";
