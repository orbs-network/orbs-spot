import type {
  CodeSnippetOptions,
  JsonContainer,
  JsonPrimitive,
  JsonValue,
  JsonValuePath,
} from "./json-inspector";

const CANCEL_ABI_PLACEHOLDER = "__CANCEL_ABI__";
const CANCEL_CHAIN_PLACEHOLDER = "__CANCEL_CHAIN__";
const ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;

function serializeTypeScriptValue(
  value: JsonValue,
  getExpression: (path: JsonValuePath) => string | undefined,
  path: JsonValuePath = [],
  indent = 0,
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
  const lines = entries.map(([key, entry]) => {
    const entryPath = [...path, key];
    const propertyName = String(key);
    const prefix = Array.isArray(value)
      ? ""
      : `${
          /^[A-Za-z_$][\w$]*$/.test(propertyName)
            ? propertyName
            : JSON.stringify(propertyName)
        }: `;

    return `${" ".repeat(childIndent)}${prefix}${serializeTypeScriptValue(
      entry,
      getExpression,
      entryPath,
      childIndent,
    )}`;
  });

  return `${opening}\n${lines.join(",\n")}\n${" ".repeat(indent)}${closing}`;
}

const SIGNATURE_FIELD_EXPLANATIONS: Record<string, string> = {
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
  return `export type Address = \`0x\${string}\`;
export type Hex = \`0x\${string}\`;

export type Signature = {
  v: \`0x\${string}\`;
  r: \`0x\${string}\`;
  s: \`0x\${string}\`;
};

export type PermitOrder = {
  permitted: {
    token: Address;
    amount: string;
  };
  spender: Address;
  nonce: string;
  deadline: string;
  witness: {
    reactor: Address;
    executor: Address;
    exchange: {
      adapter: Address;
      ref: Address;
      share: number;
      data: Hex;
    };
    swapper: Address;
    nonce: string;
    start?: string;
    deadline: string;
    chainid: number;
    exclusivity: number;
    epoch: number;
    slippage: number;
    freshness: number;
    input: {
      token: Address;
      amount: string;
      maxAmount: string;
    };
    output: {
      token: Address;
      limit: string;
      stop?: string;
      triggerLower?: string;
      triggerUpper?: string;
      recipient: Address;
    };
  };
};

export type TypedDataField = {
  name: string;
  type: string;
};

export type PermitData = {
  domain: {
    name: string;
    version: string;
    chainId: number;
    verifyingContract: Address;
  };
  order: PermitOrder;
  primaryType: "RePermitWitnessTransferFrom";
  types: Record<string, TypedDataField[]>;
  partner?: string;
};

// Request body sent when creating an order.
export type SignedOrder = {
  signature: Signature;
  order: PermitOrder;
  status: "pending";
};

// Service-managed execution details returned with an order.
export type OrderMetadata = {
  chunks?: unknown[];
  expectedChunks: number;
  lastPriceCheck: string;
  nextEligibleTime: string;
  status: string;
  description: string;
  displayOnlyInputTokenPriceUSD: string;
  repermitDigest: Hex;
};

// Raw order shape returned by Orders Sink.
export type OrderResponse = {
  hash: Hex;
  metadata: OrderMetadata;
  order: PermitOrder;
  signature: Signature;
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
  swapper: Address;
  chainId: number;
  exchange: Address;
};

// Response body returned by the order-history endpoint.
export type FetchOrdersResponse = {
  orders: OrderResponse[];
};`;
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
    domain: "basePermitData.domain",
    primaryType: "basePermitData.primaryType",
    types: "basePermitData.types",
    "message.spender": "basePermitData.order.spender",
    "message.witness.reactor":
      "basePermitData.order.witness.reactor",
    "message.witness.executor":
      "basePermitData.order.witness.executor",
    "message.witness.exchange.adapter":
      "basePermitData.order.witness.exchange.adapter",
    "message.witness.exchange.ref":
      "basePermitData.order.witness.exchange.ref",
    "message.witness.exchange.share":
      "basePermitData.order.witness.exchange.share",
    "message.witness.exchange.data":
      "basePermitData.order.witness.exchange.data",
    "message.witness.chainid":
      "basePermitData.order.witness.chainid",
    "message.witness.exclusivity":
      "basePermitData.order.witness.exclusivity",
    "message.witness.swapper": "account",
    "message.witness.output.recipient": "account",
    "message.witness.output.stop":
      "basePermitData.order.witness.output.stop",
  };

  return serializeTypeScriptValue(
    signTypedDataArgs,
    (path) => baseDataExpressions[path.join(".")],
  );
}

export function formatGetBasePermitDataCode(data: JsonContainer) {
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
  return `import type { PermitData } from "./order-types";

const partner = ${JSON.stringify(partner)};
const chain = ${JSON.stringify(chain)};

// Security boundary: keep this trusted endpoint fixed in your application.
// Use the partner ID assigned by Orbs, or "unknown" if none was assigned.
// Fetch and return the initial, unchanged base permit data.
export const getBasePermitData = async (): Promise<PermitData> => {
  const response = await fetch(
    \`https://order-sink-v2.orbs.network/config?partner=\${partner}&chain=\${chain}\`,
    { headers: { Accept: "application/json" } },
  );

  if (!response.ok) {
    throw new Error(\`Failed to fetch permit config (\${response.status})\`);
  }

  const basePermitData = (await response.json()) as PermitData;
  return basePermitData;
};`;
}

export function formatSignOrderExampleCode(data: JsonContainer) {
  const serializedArgs = formatSignTypedDataArgs(data);

  return `import { useCallback } from "react";
import { parseSignature, toHex } from "viem";
import { useConnection, useSignTypedData } from "wagmi";

import { getBasePermitData } from "./get-base-permit-data";
import type { Signature } from "./order-types";

// Hooks stay inside a custom hook so this file follows React's Rules of Hooks.
export function useSignOrder() {
  const { address: account } = useConnection();
  const { signTypedDataAsync } = useSignTypedData();

  return useCallback(async () => {
    if (!account) throw new Error("Connect a wallet before signing");

    // Fetch trusted contract fields and layer in fresh form/quote values.
    // Replace the sample amounts, nonces, and timestamps shown below.
    const basePermitData = await getBasePermitData();
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

  return `import { useCallback } from "react";
import {
  erc20Abi,
  maxUint256,
  parseAbi,
  parseSignature,
  toHex,
  zeroAddress,
} from "viem";
import {
  useConnection,
  usePublicClient,
  useSignTypedData,
  useWalletClient,
} from "wagmi";

import { createOrder } from "./create-order";
import { getBasePermitData } from "./get-base-permit-data";
import type { Address, Signature } from "./order-types";

const wrappedNativeAbi = parseAbi(["function deposit() payable"]);

// One hook owns the complete Orders Sink creation flow.
export function useSubmitOrdersSinkOrder() {
  const { address: account } = useConnection();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { signTypedDataAsync } = useSignTypedData();

  return useCallback(async () => {
    if (!account || !publicClient || !walletClient) {
      throw new Error("Connect a wallet before creating an order");
    }

    // 1. GET /config from the trusted Orders Sink endpoint.
    const basePermitData = await getBasePermitData();

    // 2. Build the order once. Replace sample literals with fresh form/quote
    // values, then never rebuild this object between signing and submit.
    const signTypedDataArgs = ${serializedArgs} as const;
    const order = signTypedDataArgs.message;
    const tokenAddress = order.permitted.token as Address;
    const spender = basePermitData.domain.verifyingContract;
    const requiredAmount = BigInt(order.permitted.amount);

    if (
      walletClient.chain.id !== basePermitData.domain.chainId ||
      order.witness.chainid !== basePermitData.domain.chainId
    ) {
      throw new Error("Wallet, domain, and order chain IDs must match");
    }

    // 3. Read allowance without prompting the wallet.
    const allowance = await publicClient.readContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: "allowance",
      args: [account, spender],
    });

    // 4. Native input is represented by its wrapped-token address in the order.
    const sourceTokenAddress = ${JSON.stringify(sourceTokenAddress)} as Address;
    if (sourceTokenAddress.toLowerCase() === zeroAddress) {
      const wrapHash = await walletClient.writeContract({
        address: tokenAddress,
        abi: wrappedNativeAbi,
        functionName: "deposit",
        value: requiredAmount,
        account,
        chain: walletClient.chain,
      });
      await publicClient.waitForTransactionReceipt({ hash: wrapHash });
    }

    // 5. Approve only when the current allowance is insufficient.
    if (allowance < requiredAmount) {
      const approveHash = await walletClient.writeContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: "approve",
        args: [spender, maxUint256],
        account,
        chain: walletClient.chain,
      });
      await publicClient.waitForTransactionReceipt({ hash: approveHash });
    }

    // 6. Sign the exact order object created above.
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

    // 7. POST that same order object to Orders Sink.
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

export function formatLiveCreateOrderCode(data: JsonContainer) {
  const serializedArgs = formatSignTypedDataArgs(data);

  return `import { useCallback } from "react";
import { parseSignature, toHex } from "viem";
import { useConnection, useSignTypedData } from "wagmi";

import { createOrder } from "./create-order";
import { getBasePermitData } from "./get-base-permit-data";
import type { Signature } from "./order-types";

export function useSignAndCreateOrder() {
  const { address: account } = useConnection();
  const { signTypedDataAsync } = useSignTypedData();

  return useCallback(async () => {
    if (!account) throw new Error("Connect a wallet before signing");

    // Build one order object and reuse it for both operations.
    const basePermitData = await getBasePermitData();
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

  return `import { getBasePermitData } from "./get-base-permit-data";
import type { FetchOrdersResponse, PermitData } from "./order-types";

export const fetchOrders = async () => {
  // Use the base permit data to target the configured exchange adapter.
  const basePermitData: PermitData = await getBasePermitData();

  // Request orders for this wallet, chain, and exchange.
  const response = await fetch(
    \`${endpoint}?swapper=${swapper}&chainId=${chainId}&exchange=\${basePermitData.order.witness.exchange.adapter}\`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
    },
  );

  // Stop before parsing order data when the HTTP request failed.
  if (!response.ok) {
    throw new Error(\`Failed to fetch orders (\${response.status})\`);
  }

  // Return only the order list consumed by order history.
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

export const getBasePermitData = async (): Promise<PermitData> => {
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
  const writeContractArgs = {
    abi: CANCEL_ABI_PLACEHOLDER,
    functionName: data.functionName,
    address: data.address,
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
    .replace(JSON.stringify(CANCEL_CHAIN_PLACEHOLDER), "walletClient.chain")
    .replace(/^(\s*)"([A-Za-z_$][\w$]*)":/gm, "$1$2:")
    .replace(
      /^  (abi|functionName|address|args|chain|account):/gm,
      (_match, field: string) =>
        `  // ${fieldSourceComments[field]}\n  ${field}:`,
    );

  return `import { useCallback } from "react";
import { parseAbi } from "viem";
import { usePublicClient, useWalletClient } from "wagmi";

// Use the connected wallet and the cancellation ABI shown by the current order.
// The connected wallet should be on chain ${chainId} before submitting.
const cancelAbi = parseAbi([${JSON.stringify(abi)}]);

export function useCancelSelectedOrder() {
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  return useCallback(async () => {
    if (!publicClient || !walletClient) {
      throw new Error("Connect a wallet before cancelling");
    }

    const hash = await walletClient.writeContract(${serializedArgs});
    await publicClient.waitForTransactionReceipt({ hash });
    return hash;
  }, [publicClient, walletClient]);
}`;
}

export function formatCancelOrderExampleCode() {
  return `import { useCallback } from "react";
import type { Hex, PermitData } from "./order-types";
import { parseAbi } from "viem";
import { useConnection, usePublicClient, useWalletClient } from "wagmi";

import { getBasePermitData } from "./get-base-permit-data";

const cancelAbi = parseAbi(["function cancel(bytes32[] digests)"]);

export function useCancelOrderExample() {
  const { address: account } = useConnection();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  return useCallback(async (repermitDigest: Hex) => {
    if (!account || !publicClient || !walletClient) {
      throw new Error("Connect a wallet before cancelling");
    }

    const basePermitData: PermitData = await getBasePermitData();
    const hash = await walletClient.writeContract({
      address: basePermitData.domain.verifyingContract,
      abi: cancelAbi,
      functionName: "cancel",
      args: [[repermitDigest]],
      account,
      chain: walletClient.chain,
    });

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

const GET_BASE_PERMIT_DATA_FILE = {
  format: formatGetBasePermitDataCode,
  name: "get-base-permit-data.ts",
  syntaxLanguage: "typescript",
} as const;

export const SIGNATURE_EXAMPLE_CODE_SNIPPET: CodeSnippetOptions = {
  copyLabel: "Copy code",
  fileName: "sign-order.ts",
  files: [GET_BASE_PERMIT_DATA_FILE, ORDER_TYPES_FILE],
  format: formatSignOrderExampleCode,
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
  files: [GET_BASE_PERMIT_DATA_FILE, ORDER_TYPES_FILE],
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
  files: [
    GET_BASE_PERMIT_DATA_FILE,
    CREATE_ORDER_FILE,
    ORDER_TYPES_FILE,
  ],
  format: formatLiveCreateOrderCode,
  inlineEditable: true,
  language: "TypeScript",
  syntaxLanguage: "typescript",
};

export const FULL_ORDER_FLOW_CODE_SNIPPET: CodeSnippetOptions = {
  copyLabel: "Copy code",
  fileName: "create-orders-sink-order.ts",
  files: [
    GET_BASE_PERMIT_DATA_FILE,
    CREATE_ORDER_FILE,
    ORDER_TYPES_FILE,
  ],
  format: formatFullOrderFlowCode,
  language: "TypeScript",
  syntaxLanguage: "typescript",
};

export const CREATE_ORDER_CODE_SNIPPET: CodeSnippetOptions = {
  copyLabel: "Copy code",
  fileName: "create-order.ts",
  files: [ORDER_TYPES_FILE],
  format: formatCreateOrderFetchCode,
  language: "TypeScript",
  syntaxLanguage: "typescript",
};

export const FETCH_ORDERS_CODE_SNIPPET: CodeSnippetOptions = {
  copyLabel: "Copy code",
  fileName: "fetch-orders.ts",
  files: [GET_BASE_PERMIT_DATA_FILE, ORDER_TYPES_FILE],
  format: formatFetchOrdersCode,
  language: "TypeScript",
  syntaxLanguage: "typescript",
};

export const PERMIT_CONFIG_CODE_SNIPPET: CodeSnippetOptions = {
  copyLabel: "Copy code",
  fileName: "get-base-permit-data.ts",
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
