import type {
  CodeSnippetFileOptions,
  CodeSnippetOptions,
  JsonContainer,
  JsonValue,
  JsonValuePath,
} from "./json-inspector";
import {
  formatPartnerDeclaration,
  getExamplePartnerId,
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
  const partner = getExamplePartnerId(root.partner);
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

function getQuotePayloadFallbackExplanation(path: JsonValuePath): string {
  const field = path.findLast(
    (segment): segment is string => typeof segment === "string",
  );

  return `The SDK-provided ${field ?? "quote"} field in this wallet-bound quote. Preserve it unchanged through signing and swap submission.`;
}

export function formatLiquidityHubSetupCode(data: JsonContainer): string {
  const { chainId, partner } = getExampleParams(data);

  return `import { constructSDK } from "@orbs-network/liquidity-hub-sdk";

const chainId = ${chainId};
${formatPartnerDeclaration(partner)}

export const liquidityHub = constructSDK({
  chainId,
  partner,
});`;
}

export function formatLiquidityHubTypesCode(): string {
  return `import type { Address, Hex } from "viem";

export type LiquidityHubQuoteArgs = {
  fromToken: string;
  toToken: string;
  inAmount: string;
  dexMinAmountOut: string;
  account?: string;
  slippage: number;
  signal?: AbortSignal;
  timeout?: number;
};

export type LiquidityHubQuote = {
  inToken: string;
  outToken: string;
  inAmount: string;
  outAmount: string;
  minAmountOut: string;
  user: string;
  slippage: number;
  qs: string;
  partner: string;
  exchange: string;
  sessionId: string;
  serializedOrder: string;
  permitData: any;
  eip712: unknown;
  userMinOutAmountWithGas: string;
  outAmountWsMinusGas: string;
  outAmountWS: string;
  timestamp: number;
  error?: string;
  gasAmountOut?: string;
  referencePrice?: string;
};

// Quote data and the DEX-protected minimum already owned by the review flow.
export type ExistingQuoteData = {
  liquidityHubQuote: LiquidityHubQuote;
  // Pass the DEX router's slippage-adjusted minimum output, not its raw quote.
  dexMinAmountOut: string;
};

// Optional calldata for a DEX router route submitted through Liquidity Hub.
export type DexRouterData = {
  data?: Hex;
  to?: Address;
};`;
}

export function formatLiquidityHubPermitSigningCode(): string {
  return `import type { Address, Hex, WalletClient } from "viem";

import type { LiquidityHubQuote } from "./liquidity-hub-types";

export async function signLiquidityHubPermit(
  quote: LiquidityHubQuote,
  walletClient: WalletClient,
): Promise<Hex> {
  return walletClient.signTypedData({
    account: quote.user as Address,
    domain: quote.permitData.domain,
    types: quote.permitData.types,
    primaryType: quote.permitData.primaryType,
    message: quote.permitData.values,
  });
}`;
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

  return `import { constructSDK, isFreshQuote } from "@orbs-network/liquidity-hub-sdk";
import type { LiquidityHubQuote } from "./types";

const chainId = ${chainId};
${formatPartnerDeclaration(partner)}
const liquidityHub = constructSDK({ chainId, partner });
let quotePayload = ${formatJsonObject(quotePayload)} as LiquidityHubQuote;

export function getLatestQuote(): LiquidityHubQuote | Promise<LiquidityHubQuote> {
  if (!isFreshQuote(quotePayload)) {
    return liquidityHub
      .getQuote({
        fromToken: quotePayload.inToken,
        toToken: quotePayload.outToken,
        inAmount: quotePayload.inAmount,
        dexMinAmountOut: "-1",
        slippage: quotePayload.slippage,
        account: quotePayload.user,
      })
      .then((quote) => {
        quotePayload = quote;
        return quotePayload;
      });
  }

  return quotePayload;
}

/*
Latest quote flow

1. Start with the exact Liquidity Hub quote response already owned by the flow.
2. Use the SDK's isFreshQuote() check to keep that payload while it is valid.
3. When stale, request the same tokens, total input amount, slippage, and wallet.
   dexMinAmountOut is -1 because this flow executes Liquidity Hub only.
4. Replace quotePayload with the response so signing and swap use the same quote.
5. Callers await getLatestQuote(); the fresh path returns immediately, while the
   stale path resolves after the replacement quote is fetched.
*/`;
}

export function formatLiquidityHubQuoteCode(data: JsonContainer): string {
  const { quoteArgs } = getExampleParams(data);
  const serializedQuoteArgs = formatTypeScriptObject(quoteArgs);

  return `import { useCallback } from "react";
import { liquidityHub } from "./liquidity-hub";
import type {
  LiquidityHubQuote,
  LiquidityHubQuoteArgs,
} from "./liquidity-hub-types";

const quoteArgs = ${serializedQuoteArgs} satisfies LiquidityHubQuoteArgs;

export function useFetchLiquidityHubQuote() {
  return useCallback(async () => {
    const quote = await getLiquidityHubQuote();

    const selectedRoute =
      BigInt(quote.minAmountOut) > BigInt(quoteArgs.dexMinAmountOut)
        ? "liquidity-hub"
        : "dex";

    return { quote, selectedRoute };
  }, []);
}

async function getLiquidityHubQuote(): Promise<LiquidityHubQuote> {
  return liquidityHub.getQuote(quoteArgs);
}

/*
Quote flow

1. Build quoteArgs from the quote data already owned by the DEX swap form.
2. Use the wrapped ERC-20 address when the DEX source is native currency.
3. Fetch the Liquidity Hub quote and compare protected minimum outputs.
*/`;
}

export function formatLiquidityHubLiveQuoteCode(data: JsonContainer): string {
  const { chainId, partner, quoteArgs } = getExampleParams(data);
  const serializedQuoteArgs = formatTypeScriptObject(quoteArgs);

  return `import { constructSDK } from "@orbs-network/liquidity-hub-sdk";
import type { LiquidityHubQuote, LiquidityHubQuoteArgs } from "./types";

const chainId = ${chainId};
${formatPartnerDeclaration(partner)}
const quoteArgs = ${serializedQuoteArgs} satisfies LiquidityHubQuoteArgs;
const liquidityHub = constructSDK({ chainId, partner });

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

export function formatLiquidityHubCompareCode(data: JsonContainer): string {
  const root = Array.isArray(data) ? {} : data;
  const quote = getRecord(root.quote);
  const liquidityHubMinAmountOut = getString(
    quote.minAmountOut,
    "<liquidity-hub-min-output>",
  );

  return `import type { ExistingQuoteData } from "./liquidity-hub-types";

export function selectBestRoute(
  { liquidityHubQuote, dexMinAmountOut }: ExistingQuoteData,
): "dex" | "liquidity-hub" {
  if (dexMinAmountOut === "-1") {
    throw new Error(
      "Replace -1 with the DEX router minimum output before selecting a route",
    );
  }

  // Current Liquidity Hub minimum: ${liquidityHubMinAmountOut} base units.
  return BigInt(liquidityHubQuote.minAmountOut) > BigInt(dexMinAmountOut)
    ? "liquidity-hub"
    : "dex";
}

// Call selectBestRoute with the quote data already loaded by the review UI.
// Continue through Liquidity Hub only when it wins; otherwise use the DEX.`;
}

function getFlowValues(data: JsonContainer) {
  const root = Array.isArray(data) ? {} : data;
  const quoteArgs = getRecord(root.quoteArgs);
  const quote = getRecord(root.quote);

  return {
    account: getString(
      quote.user ?? quoteArgs.account,
      "<connected-wallet-address>",
    ),
    inAmount: getString(
      quote.inAmount ?? quoteArgs.inAmount,
      "<input-amount-base-units>",
    ),
    inputIsNative: root.inputIsNative === true,
    inputToken: getString(
      quote.inToken ?? quoteArgs.fromToken,
      "<wrapped-input-token-address>",
    ),
    minAmountOut: getString(
      quote.minAmountOut,
      "<liquidity-hub-min-output>",
    ),
    sessionId: getString(quote.sessionId, "<liquidity-hub-session-id>"),
  };
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

export function formatLiquidityHubWrapCode(data: JsonContainer): string {
  const {
    account,
    inAmount,
    inputIsNative: sourceIsNative,
    inputToken,
  } = getFlowValues(data);

  return `import { useCallback } from "react";
import { parseAbi, type Address } from "viem";
import { useConnection, usePublicClient, useWalletClient } from "wagmi";

const sourceIsNative = ${sourceIsNative};
const wrappedInputToken = ${JSON.stringify(inputToken)} as Address;
const inAmount = ${JSON.stringify(inAmount)};
const account = ${JSON.stringify(account)} as Address;
const wrappedNativeAbi = parseAbi(["function deposit() payable"]);

export function useWrapLiquidityHubInput() {
  const { address: connectedAccount } = useConnection();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  return useCallback(async () => {
    if (!sourceIsNative) return;
    if (!connectedAccount || !publicClient || !walletClient) {
      throw new Error("Connect a wallet before wrapping");
    }
    if (connectedAccount.toLowerCase() !== account.toLowerCase()) {
      throw new Error("Quote wallet does not match the connected wallet");
    }

    const txHash = await walletClient.writeContract({
      address: wrappedInputToken,
      abi: wrappedNativeAbi,
      functionName: "deposit",
      value: BigInt(inAmount),
      account,
      chain: walletClient.chain,
    });
    await publicClient.waitForTransactionReceipt({ hash: txHash });
    return txHash;
  }, [connectedAccount, publicClient, walletClient]);
}`;
}

export function formatLiquidityHubApprovalCode(data: JsonContainer): string {
  const { account, inputToken } = getFlowValues(data);

  return `import { permit2Address } from "@orbs-network/liquidity-hub-sdk";
import { useCallback } from "react";
import { erc20Abi, maxUint256, type Address } from "viem";
import { useConnection, usePublicClient, useWalletClient } from "wagmi";

const inputToken = ${JSON.stringify(inputToken)} as Address;
const account = ${JSON.stringify(account)} as Address;

export function useApproveLiquidityHubInput() {
  const { address: connectedAccount } = useConnection();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  return useCallback(async () => {
    if (!connectedAccount || !publicClient || !walletClient) {
      throw new Error("Connect a wallet before approving");
    }
    if (connectedAccount.toLowerCase() !== account.toLowerCase()) {
      throw new Error("Quote wallet does not match the connected wallet");
    }

    const txHash = await walletClient.writeContract({
      address: inputToken,
      abi: erc20Abi,
      functionName: "approve",
      args: [permit2Address as Address, maxUint256],
      account,
      chain: walletClient.chain,
    });
    await publicClient.waitForTransactionReceipt({ hash: txHash });
    return txHash;
  }, [connectedAccount, publicClient, walletClient]);
}`;
}

export function formatLiquidityHubAllowanceCode(data: JsonContainer): string {
  const { account, inAmount, inputToken } = getFlowValues(data);

  return `import { permit2Address } from "@orbs-network/liquidity-hub-sdk";
import { useCallback } from "react";
import { erc20Abi, type Address } from "viem";
import { useConnection, usePublicClient } from "wagmi";

const inputToken = ${JSON.stringify(inputToken)} as Address;
const requiredAmount = ${JSON.stringify(inAmount)};
const account = ${JSON.stringify(account)} as Address;

export function useCheckLiquidityHubAllowance() {
  const { address: connectedAccount } = useConnection();
  const publicClient = usePublicClient();

  return useCallback(async () => {
    if (!connectedAccount || !publicClient) {
      throw new Error("Connect a wallet before checking allowance");
    }
    if (connectedAccount.toLowerCase() !== account.toLowerCase()) {
      throw new Error("Quote wallet does not match the connected wallet");
    }

    const allowance = await publicClient.readContract({
      address: inputToken,
      abi: erc20Abi,
      functionName: "allowance",
      args: [account, permit2Address as Address],
    });

    return {
      allowance: allowance.toString(),
      approvalRequired: allowance < BigInt(requiredAmount),
    };
  }, [connectedAccount, publicClient]);
}`;
}

export function formatLiquidityHubSignCode(): string {
  return `import { useCallback } from "react";
import type { Address } from "viem";
import { useWalletClient } from "wagmi";
import { getLatestQuote } from "./get-latest-quote";

export function useSignLiquidityHubQuote() {
  const { data: walletClient } = useWalletClient();

  return useCallback(async () => {
    const quote = await getLatestQuote();
    const signature = await walletClient!.signTypedData({
      account: quote.user as Address,
      domain: quote.permitData.domain,
      types: quote.permitData.types,
      primaryType: quote.permitData.primaryType,
      message: quote.permitData.values,
    });

    return { quote, signature };
  }, [walletClient]);
}`;
}

export function formatLiquidityHubSwapAndConfirmCode(
  data: JsonContainer,
): string {
  const { chainId, partner } = getExampleParams(data);
  const { signature } = getLiveFlowCodeValues(data);

  return `import { constructSDK } from "@orbs-network/liquidity-hub-sdk";
import { useCallback } from "react";
import type { Hash } from "viem";
import { usePublicClient } from "wagmi";
import { getLatestQuote } from "./get-latest-quote";

const chainId = ${chainId};
${formatPartnerDeclaration(partner)}
const liquidityHub = constructSDK({ chainId, partner });
const signature = ${JSON.stringify(signature)};

export function useSwapAndConfirmLiquidityHub() {
  const publicClient = usePublicClient();

  return useCallback(async () => {
    const quote = await getLatestQuote();
    const txHash = await (liquidityHub.swap(quote, signature) as Promise<Hash>);
    const receipt = await publicClient!.waitForTransactionReceipt({ hash: txHash });

    return receipt;
  }, [publicClient]);
}`;
}

export function formatLiquidityHubFullFlowCode(data: JsonContainer): string {
  const { chainId, inputIsNative, partner } = getExampleParams(data);

  return `import { useCallback } from "react";
import { constructSDK, permit2Address } from "@orbs-network/liquidity-hub-sdk";
import { erc20Abi, maxUint256, parseAbi, type Address } from "viem";
import { useConnection, usePublicClient, useWalletClient } from "wagmi";
import { getLatestQuote } from "./get-latest-quote";

const chainId = ${chainId};
${formatPartnerDeclaration(partner)}
const sourceIsNative = ${inputIsNative};
const wrappedNativeAbi = parseAbi(["function deposit() payable"]);
const liquidityHub = constructSDK({ chainId, partner });

export function useExecuteLiquidityHubFlow() {
  const { address: account } = useConnection();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  return useCallback(async () => {
    const connectedAccount = account as Address;
    const reader = publicClient!;
    const signer = walletClient!;
    let quote = await getLatestQuote();

    const allowance = await reader.readContract({
      address: quote.inToken as Address,
      abi: erc20Abi,
      functionName: "allowance",
      args: [connectedAccount, permit2Address as Address],
    });

    if (sourceIsNative) {
      const wrapHash = await signer.writeContract({
        address: quote.inToken as Address,
        abi: wrappedNativeAbi,
        functionName: "deposit",
        value: BigInt(quote.inAmount),
        account: connectedAccount,
        chain: signer.chain,
      });
      await reader.waitForTransactionReceipt({ hash: wrapHash });
    }

    if (allowance < BigInt(quote.inAmount)) {
      const approvalHash = await signer.writeContract({
        address: quote.inToken as Address,
        abi: erc20Abi,
        functionName: "approve",
        args: [permit2Address as Address, maxUint256],
        account: connectedAccount,
        chain: signer.chain,
      });
      await reader.waitForTransactionReceipt({ hash: approvalHash });
    }

    quote = await getLatestQuote();

    const signature = await signer.signTypedData({
      account: quote.user as Address,
      domain: quote.permitData.domain,
      types: quote.permitData.types,
      primaryType: quote.permitData.primaryType,
      message: quote.permitData.values,
    });
    const txHash = await (liquidityHub.swap(quote, signature) as Promise<Address>);

    const receipt = await reader.waitForTransactionReceipt({ hash: txHash });
    return receipt;
  }, [account, publicClient, walletClient]);
}

/*
Liquidity Hub flow

1. Load the wallet-bound Liquidity Hub quote from getLatestQuote(). The helper
   returns the current payload when the SDK considers it fresh and replaces it
   with a newly fetched quote when it is stale.
2. Read the wrapped input token's Permit2 allowance for quote.inAmount.
3. Liquidity Hub does not support a native asset as inToken. When the selected
   source is native, wrap quote.inAmount into quote.inToken and wait for the
   transaction to confirm.
4. When the allowance is insufficient, approve Permit2 and wait for the
   approval transaction to confirm.
5. Call getLatestQuote() again immediately before signing so it fetches a new
   quote only when the current payload is stale.
6. Sign the fresh quote's opaque permit data with the connected wallet.
7. Pass the same fresh quote and signature to liquidityHub.swap().
8. Wait for the returned transaction hash to receive an on-chain receipt.
*/
`;
}

export function formatLiquidityHubSwapCode(data: JsonContainer): string {
  const { inputIsNative, quoteArgs } = getExampleParams(data);
  const serializedQuoteArgs = formatTypeScriptObject(quoteArgs);

  return `import { permit2Address } from "@orbs-network/liquidity-hub-sdk";
import { useCallback } from "react";
import { erc20Abi, maxUint256, parseAbi, type Address, type Hex } from "viem";
import { useConnection, usePublicClient, useWalletClient } from "wagmi";

import { liquidityHub } from "./liquidity-hub";
import { currentLiquidityHubQuote } from "./liquidity-hub-quote";
import type { DexRouterData, LiquidityHubQuote, LiquidityHubQuoteArgs } from "./liquidity-hub-types";
import { signLiquidityHubPermit } from "./sign-liquidity-hub-permit";

const sourceIsNative = ${inputIsNative};
const wrappedNativeAbi = parseAbi(["function deposit() payable"]);
const quoteArgs = ${serializedQuoteArgs} satisfies LiquidityHubQuoteArgs;
const dexRouterData = {
  to: "<dex-router-address>" as Address,
  data: "<dex-router-calldata>" as Hex,
} satisfies Required<DexRouterData>;

export function useExecuteBestRoute() {
  const { address: account } = useConnection();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  return useCallback(async () => {
    const quote = currentLiquidityHubQuote;

    if (BigInt(quote.minAmountOut) <= BigInt(quoteArgs.dexMinAmountOut)) {
      const txHash = await walletClient.sendTransaction({
        ...dexRouterData,
        account,
        chain: walletClient.chain,
      });
      return { quote, route: "dex" as const, txHash };
    }

    if (sourceIsNative) {
      const wrapHash = await walletClient.writeContract({
        address: quote.inToken as Address,
        abi: wrappedNativeAbi,
        functionName: "deposit",
        value: BigInt(quote.inAmount),
        account,
        chain: walletClient.chain,
      });
      await publicClient.waitForTransactionReceipt({ hash: wrapHash });
    }

    const allowance = await publicClient.readContract({
      address: quote.inToken as Address,
      abi: erc20Abi,
      functionName: "allowance",
      args: [account, permit2Address as Address],
    });
    if (allowance < BigInt(quote.inAmount)) {
      const approvalHash = await walletClient.writeContract({
        address: quote.inToken as Address,
        abi: erc20Abi,
        functionName: "approve",
        args: [permit2Address as Address, maxUint256],
        account,
        chain: walletClient.chain,
      });
      await publicClient.waitForTransactionReceipt({ hash: approvalHash });
    }

    const signature = await signLiquidityHubPermit(quote, walletClient);
    const txHash = await (liquidityHub.swap(quote, signature) as Promise<Address>);

    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    return {
      quote,
      receipt,
      signature,
      txHash,
    };
  }, [account, publicClient, walletClient]);
}

/*
Liquidity Hub best-route swap flow

1. Start with the Liquidity Hub quote and the DEX router's slippage-adjusted
   minimum output already available in the DEX review or submit flow.
2. Compare protected minimum outputs. Continue through Liquidity Hub only when
   quote.minAmountOut is higher; otherwise execute and report the normal DEX
   route.
3. Liquidity Hub does not support a native asset as inToken. When the DEX source
   is native, use its wrapped ERC-20 address in the quote, wrap quote.inAmount
   into quote.inToken, and wait for the transaction to confirm.
4. Read the quote input token's Permit2 allowance. When it is insufficient,
   approve Permit2 and wait for confirmation.
5. Pass the existing quote unchanged to signLiquidityHubPermit(). The isolated
   adapter owns the SDK-returned EIP-712 signing data.
6. Pass the same quote and signature to liquidityHub.swap().
7. Wait for the returned transaction hash to receive an on-chain receipt.
*/
`;
}

const SETUP_FILE: CodeSnippetFileOptions = {
  format: formatLiquidityHubSetupCode,
  name: "liquidity-hub.ts",
  syntaxLanguage: "typescript",
};

const TYPES_FILE: CodeSnippetFileOptions = {
  format: formatLiquidityHubTypesCode,
  name: "liquidity-hub-types.ts",
  showFieldTooltips: false,
  syntaxLanguage: "typescript",
};

const COMPACT_TYPES_FILE: CodeSnippetFileOptions = {
  format: formatLiquidityHubTypesCode,
  name: "types.ts",
  showFieldTooltips: false,
  syntaxLanguage: "typescript",
};

const GET_LATEST_QUOTE_FILE: CodeSnippetFileOptions = {
  fieldPathAliases: { quotePayload: ["quote"] },
  format: formatLiquidityHubGetLatestQuoteCode,
  getFallbackFieldExplanation: getQuotePayloadFallbackExplanation,
  hiddenFieldTooltipDescendantKeys: ["types"],
  name: "get-latest-quote.ts",
  syntaxLanguage: "typescript",
};

const PERMIT_SIGNING_FILE: CodeSnippetFileOptions = {
  format: formatLiquidityHubPermitSigningCode,
  name: "sign-liquidity-hub-permit.ts",
  syntaxLanguage: "typescript",
};

const CURRENT_QUOTE_FILE: CodeSnippetFileOptions = {
  format: formatLiquidityHubCurrentQuoteCode,
  name: "liquidity-hub-quote.ts",
  syntaxLanguage: "typescript",
};

export const LIQUIDITY_HUB_SETUP_CODE_SNIPPET: CodeSnippetOptions = {
  copyLabel: "Copy code",
  fileName: "liquidity-hub.ts",
  format: formatLiquidityHubSetupCode,
  language: "TypeScript",
  syntaxLanguage: "typescript",
};

export const LIQUIDITY_HUB_QUOTE_CODE_SNIPPET: CodeSnippetOptions = {
  copyLabel: "Copy code",
  fileName: "use-liquidity-hub-quote.ts",
  files: [
    SETUP_FILE,
    CURRENT_QUOTE_FILE,
    TYPES_FILE,
    PERMIT_SIGNING_FILE,
  ],
  format: formatLiquidityHubQuoteCode,
  language: "TypeScript",
  syntaxLanguage: "typescript",
};

export const LIQUIDITY_HUB_LIVE_QUOTE_CODE_SNIPPET: CodeSnippetOptions = {
  copyLabel: "Copy code",
  fileName: "quote.ts",
  files: [COMPACT_TYPES_FILE],
  format: formatLiquidityHubLiveQuoteCode,
  language: "TypeScript",
  syntaxLanguage: "typescript",
};

export const LIQUIDITY_HUB_COMPARE_CODE_SNIPPET: CodeSnippetOptions = {
  copyLabel: "Copy code",
  fileName: "select-best-route.ts",
  files: [TYPES_FILE],
  format: formatLiquidityHubCompareCode,
  language: "TypeScript",
  syntaxLanguage: "typescript",
};

export const LIQUIDITY_HUB_WRAP_CODE_SNIPPET: CodeSnippetOptions = {
  copyLabel: "Copy code",
  fileName: "wrap-native-input.ts",
  files: [SETUP_FILE],
  format: formatLiquidityHubWrapCode,
  language: "TypeScript",
  syntaxLanguage: "typescript",
};

export const LIQUIDITY_HUB_APPROVAL_CODE_SNIPPET: CodeSnippetOptions = {
  copyLabel: "Copy code",
  fileName: "approve-permit2.ts",
  files: [SETUP_FILE],
  format: formatLiquidityHubApprovalCode,
  language: "TypeScript",
  syntaxLanguage: "typescript",
};

export const LIQUIDITY_HUB_ALLOWANCE_CODE_SNIPPET: CodeSnippetOptions = {
  copyLabel: "Copy code",
  fileName: "check-permit2-allowance.ts",
  format: formatLiquidityHubAllowanceCode,
  language: "TypeScript",
  syntaxLanguage: "typescript",
};

export const LIQUIDITY_HUB_SIGN_CODE_SNIPPET: CodeSnippetOptions = {
  copyLabel: "Copy code",
  fileName: "sign-liquidity-hub-quote.ts",
  files: [GET_LATEST_QUOTE_FILE, COMPACT_TYPES_FILE],
  format: formatLiquidityHubSignCode,
  language: "TypeScript",
  syntaxLanguage: "typescript",
};

export const LIQUIDITY_HUB_SWAP_AND_CONFIRM_CODE_SNIPPET: CodeSnippetOptions = {
  copyLabel: "Copy code",
  fileName: "swap-and-confirm-liquidity-hub.ts",
  files: [GET_LATEST_QUOTE_FILE, COMPACT_TYPES_FILE],
  format: formatLiquidityHubSwapAndConfirmCode,
  language: "TypeScript",
  syntaxLanguage: "typescript",
};

export const LIQUIDITY_HUB_FULL_FLOW_CODE_SNIPPET: CodeSnippetOptions = {
  copyLabel: "Copy code",
  fileName: "full-flow.ts",
  files: [GET_LATEST_QUOTE_FILE, COMPACT_TYPES_FILE],
  format: formatLiquidityHubFullFlowCode,
  language: "TypeScript",
  syntaxLanguage: "typescript",
};

export const LIQUIDITY_HUB_SWAP_CODE_SNIPPET: CodeSnippetOptions = {
  copyLabel: "Copy code",
  fileName: "use-liquidity-hub-swap.ts",
  files: [
    CURRENT_QUOTE_FILE,
    PERMIT_SIGNING_FILE,
    TYPES_FILE,
    SETUP_FILE,
  ],
  format: formatLiquidityHubSwapCode,
  language: "TypeScript",
  syntaxLanguage: "typescript",
};

const FIELD_EXPLANATIONS: Record<string, string> = {
  partner:
    'The DEX partner ID provided by Orbs. Use "unknown" when no ID was assigned.',
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
  quote:
    "The complete wallet-bound Liquidity Hub quote. Preserve it unchanged through signing and swap submission.",
  inToken: "The wrapped ERC-20 input token used by the accepted quote.",
  outToken: "The ERC-20 output token returned by the quote.",
  inAmount: "The quoted input amount in base units.",
  outAmount: "The quoted output amount before the app's display adjustments.",
  minAmountOut: "The minimum output protected by the quote.",
  user: "The wallet bound to the quote and EIP-712 signature.",
  slippage: "The slippage percentage applied to the quote.",
  qs: "Opaque quote metadata returned by Liquidity Hub. Preserve it unchanged with the quote.",
  exchange:
    "The Liquidity Hub exchange contract selected for this quote. Preserve it unchanged.",
  sessionId:
    "The Liquidity Hub session identifier used to correlate the quote, swap, and transaction details.",
  serializedOrder:
    "The opaque serialized solver order returned by Liquidity Hub. Submit it unchanged as part of the quote.",
  permitData:
    "Opaque EIP-712 Permit2 data returned by Liquidity Hub. Pass it through unchanged to the isolated signing adapter.",
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
  "permitData.primaryType":
    "The root EIP-712 type the wallet signs for this Liquidity Hub quote.",
  "permitData.values":
    "The exact Permit2 message values returned by Liquidity Hub. Sign them unchanged.",
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
  "permitData.message":
    "The complete EIP-712 Permit2 message returned by Liquidity Hub. Pass it to the wallet unchanged.",
  "permitData.message.permitted":
    "The input-token permission covered by this Permit2 signature.",
  "permitData.message.permitted.token":
    "The ERC-20 input token authorized by the Permit2 signature.",
  "permitData.message.permitted.amount":
    "The maximum input-token amount authorized by the signature, in base units.",
  "permitData.message.spender":
    "The contract authorized to consume the signed Permit2 transfer.",
  "permitData.message.nonce":
    "The Permit2 nonce that prevents this signature from being replayed.",
  "permitData.message.deadline":
    "The Unix timestamp after which the Permit2 signature expires.",
  "permitData.message.witness":
    "The order data bound to the Permit2 signature. Preserve the complete witness unchanged.",
  "permitData.message.witness.info":
    "The order identity, expiry, and additional-validation settings bound to the witness.",
  "permitData.message.witness.info.reactor":
    "The reactor contract responsible for executing the signed order.",
  "permitData.message.witness.info.swapper":
    "The wallet that owns and signs the witnessed order.",
  "permitData.message.witness.info.nonce":
    "The witnessed order nonce used to prevent replay.",
  "permitData.message.witness.info.deadline":
    "The Unix timestamp after which the witnessed order can no longer execute.",
  "permitData.message.witness.info.additionalValidationContract":
    "The contract that performs any extra validation required by this order.",
  "permitData.message.witness.info.additionalValidationData":
    "Opaque validation data passed unchanged to the additional-validation contract.",
  "permitData.message.witness.decayStartTime":
    "The Unix timestamp when the order’s Dutch-auction amount begins decaying.",
  "permitData.message.witness.decayEndTime":
    "The Unix timestamp when the order’s Dutch-auction amount finishes decaying.",
  "permitData.message.witness.exclusiveFiller":
    "The address granted exclusive fill rights during the exclusivity window.",
  "permitData.message.witness.exclusivityOverrideBps":
    "The output adjustment, in basis points, required for a non-exclusive filler to execute during the exclusivity window.",
  "permitData.message.witness.inputToken":
    "The ERC-20 input token consumed by the witnessed order.",
  "permitData.message.witness.inputStartAmount":
    "The input amount at the start of the decay period, in token base units.",
  "permitData.message.witness.inputEndAmount":
    "The input amount at the end of the decay period, in token base units.",
  "permitData.message.witness.outputs":
    "The ordered output transfers produced when the witnessed order executes.",
  "permitData.message.witness.outputs.token":
    "The ERC-20 token transferred by this output entry.",
  "permitData.message.witness.outputs.startAmount":
    "This output’s amount at the start of the decay period, in token base units.",
  "permitData.message.witness.outputs.endAmount":
    "This output’s amount at the end of the decay period, in token base units.",
  "permitData.message.witness.outputs.recipient":
    "The address that receives this output transfer.",
  eip712:
    "Additional opaque EIP-712 metadata returned by Liquidity Hub. Preserve it unchanged.",
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
  timestamp: "The quote creation time used to reject stale execution data.",
  error: "A Liquidity Hub quote error. Fall back to the normal DEX route when present.",
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
  partner: "unknown",
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

export const LIQUIDITY_HUB_QUOTE_EXAMPLE_RESPONSE_DATA = {
  inToken: DEFAULT_INPUT_TOKEN,
  outToken: DEFAULT_OUTPUT_TOKEN,
  inAmount: "1000000000000000000",
  outAmount: "2495000000",
  minAmountOut: "2482525000",
  user: DEFAULT_ACCOUNT,
  slippage: 0.5,
  qs: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  partner: "unknown",
  exchange: "0x8888888888888888888888888888888888888888",
  sessionId: "example-liquidity-hub-session",
  serializedOrder: "0x1234",
  permitData: {
    domain: {
      name: "Permit2",
      chainId: DEFAULT_CHAIN_ID,
      verifyingContract: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
    },
    types: {
      PermitWitnessTransferFrom: [
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
    primaryType: "PermitWitnessTransferFrom",
    values: {
      permitted: {
        token: DEFAULT_INPUT_TOKEN,
        amount: "1000000000000000000",
      },
      spender: "0x2222222222222222222222222222222222222222",
      nonce: "42",
      deadline: "1788220800",
    },
  },
  eip712: {},
  userMinOutAmountWithGas: "2482525000",
  outAmountWsMinusGas: "2494000000",
  outAmountWS: "2495000000",
  gasAmountOut: "1000000",
  referencePrice: "2495",
  timestamp: 1788217200000,
} satisfies JsonContainer;
