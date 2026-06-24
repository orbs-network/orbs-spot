import { isAddress, zeroAddress } from "viem";
import { isNativeAddress } from "./utils";

export const PARASWAP_API_URL = "https://api.velora.xyz";
export const PARASWAP_MARKET_VERSION = "6.2";
export const PARASWAP_NATIVE_TOKEN =
  "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

export type ParaswapPriceRoute = {
  blockNumber: number;
  network: number;
  srcToken: string;
  srcDecimals: number;
  srcAmount: string;
  destToken: string;
  destDecimals: number;
  destAmount: string;
  bestRoute?: unknown[];
  gasCostUSD?: string;
  gasCost?: string;
  version?: string;
  contractAddress?: string;
  tokenTransferProxy?: string;
  contractMethod?: string;
  partner?: string;
  hmac?: string;
  maxImpactReached?: boolean;
};

export type ParaswapQuoteResponse = {
  priceRoute: ParaswapPriceRoute;
};

export type ParaswapDeltaTokenAmount = {
  token: {
    chainId: number;
    address: string;
  };
  amount: string;
  amountUSD?: string;
};

export type ParaswapDeltaRoute = {
  origin?: {
    input?: ParaswapDeltaTokenAmount;
    output?: ParaswapDeltaTokenAmount;
  };
  destination?: {
    input?: ParaswapDeltaTokenAmount;
    output?: ParaswapDeltaTokenAmount;
  };
  bridge?: unknown;
  fees?: {
    gas?: ParaswapDeltaTokenAmount;
    bridge?: ParaswapDeltaTokenAmount[];
  };
};

export type ParaswapDeltaPrice = {
  id?: string;
  side?: "SELL" | "BUY";
  route: ParaswapDeltaRoute;
  spender?: string;
  alternatives?: ParaswapDeltaRoute[];
  partner?: {
    name?: string;
    feePercent?: number;
  };
};

export type ParaswapDeltaQuoteResponse = {
  delta?: ParaswapDeltaPrice;
  market?: ParaswapPriceRoute;
  fallbackReason?: unknown;
};

export type ParaswapTransactionParams = {
  from: `0x${string}`;
  to: `0x${string}`;
  value: string;
  data: `0x${string}`;
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  gas?: string;
  chainId: number;
};

export type ParaswapDeltaTypedData = {
  domain: Record<string, unknown>;
  types: Record<string, { name: string; type: string }[]>;
  value: Record<string, unknown>;
};

export type ParaswapDeltaBuildResponse = {
  toSign: ParaswapDeltaTypedData;
  orderHash: `0x${string}`;
};

export type ParaswapDeltaOrderStatus =
  | "PENDING"
  | "AWAITING_SIGNATURE"
  | "ACTIVE"
  | "SUSPENDED"
  | "CANCELLING"
  | "BRIDGING"
  | "COMPLETED"
  | "FAILED"
  | "EXPIRED"
  | "REFUNDING"
  | "CANCELLED"
  | "REFUNDED";

export type ParaswapDeltaOrder = {
  id: string;
  status?: ParaswapDeltaOrderStatus;
  orderHash?: string;
  transactions?: {
    originTx?: string;
    destinationTx?: string;
    filledPercent?: number;
    spentAmount?: string;
    receivedAmount?: string;
  }[];
  output?: {
    executedAmount?: string;
    expectedAmount?: string;
  };
  error?: string;
};

type ParaswapBaseTradeQuote = {
  provider: "paraswap";
  executionMode: "market" | "delta";
  outAmount: string;
  minAmountOut: string;
  inToken: string;
  outToken: string;
  inAmount: string;
  gas: string;
  gasUsd?: string;
  timestamp: number;
  spender: string;
  srcToken: string;
  destToken: string;
  srcDecimals: number;
  destDecimals: number;
  slippageBps: number;
};

export type ParaswapMarketTradeQuote = ParaswapBaseTradeQuote & {
  executionMode: "market";
  originalQuote: ParaswapPriceRoute;
  priceRoute: ParaswapPriceRoute;
  marketPriceRoute: ParaswapPriceRoute;
};

export type ParaswapDeltaTradeQuote = ParaswapBaseTradeQuote & {
  executionMode: "delta";
  originalQuote: ParaswapDeltaPrice;
  delta: ParaswapDeltaPrice;
  deltaRoute: ParaswapDeltaRoute;
  priceRoute?: ParaswapPriceRoute;
  marketPriceRoute?: ParaswapPriceRoute;
};

export type ParaswapTradeQuote =
  | ParaswapMarketTradeQuote
  | ParaswapDeltaTradeQuote;

export const getParaswapTokenAddress = (address: string) =>
  isNativeAddress(address) ? PARASWAP_NATIVE_TOKEN : address;

export const isParaswapTokenAddress = (address?: string | null) =>
  Boolean(
    address &&
      (isNativeAddress(address) ||
        address.toLowerCase() === PARASWAP_NATIVE_TOKEN.toLowerCase() ||
        isAddress(address)),
  );

export const getParaswapSlippageBps = (slippage: number) =>
  Math.max(0, Math.min(10_000, Math.round(slippage * 100)));

export const getParaswapMinAmountOut = (
  destAmount: string,
  slippageBps: number,
) => {
  if (!/^\d+$/.test(destAmount)) return "0";

  const amount = BigInt(destAmount);
  const bps = BigInt(Math.max(0, Math.min(10_000, slippageBps)));
  const bpsDenominator = BigInt(10_000);
  return ((amount * (bpsDenominator - bps)) / bpsDenominator).toString();
};

export const getParaswapUserMinAmountOut = (
  quote: Pick<ParaswapTradeQuote, "minAmountOut">,
) => quote.minAmountOut;

export const isFreshParaswapQuote = (
  quote?: Pick<ParaswapTradeQuote, "timestamp">,
  maxAgeSeconds = 60,
) => Boolean(quote && Date.now() - quote.timestamp < maxAgeSeconds * 1000);

export const getParaswapSpender = (priceRoute: ParaswapPriceRoute) =>
  priceRoute.tokenTransferProxy || priceRoute.contractAddress || "";

export const getAppTokenAddressFromParaswap = (address?: string) =>
  address?.toLowerCase() === PARASWAP_NATIVE_TOKEN.toLowerCase()
    ? zeroAddress
    : address ?? "";

export const createParaswapTradeQuote = ({
  inputAddress,
  outputAddress,
  priceRoute,
  slippageBps,
}: {
  inputAddress: string;
  outputAddress: string;
  priceRoute: ParaswapPriceRoute;
  slippageBps: number;
}): ParaswapTradeQuote => ({
  provider: "paraswap",
  executionMode: "market",
  outAmount: priceRoute.destAmount,
  minAmountOut: getParaswapMinAmountOut(priceRoute.destAmount, slippageBps),
  inToken: inputAddress,
  outToken: outputAddress,
  inAmount: priceRoute.srcAmount,
  gas: priceRoute.gasCost ?? "0",
  gasUsd: priceRoute.gasCostUSD,
  timestamp: Date.now(),
  originalQuote: priceRoute,
  priceRoute,
  marketPriceRoute: priceRoute,
  spender: getParaswapSpender(priceRoute),
  srcToken: priceRoute.srcToken,
  destToken: priceRoute.destToken,
  srcDecimals: priceRoute.srcDecimals,
  destDecimals: priceRoute.destDecimals,
  slippageBps,
});

const getDeltaAmount = (
  delta: ParaswapDeltaPrice,
  path: "origin.input" | "destination.output" | "origin.output",
) => {
  if (path === "origin.input") {
    return delta.route.origin?.input?.amount ?? "0";
  }
  if (path === "origin.output") {
    return delta.route.origin?.output?.amount ?? "0";
  }
  return (
    delta.route.destination?.output?.amount ??
    delta.route.origin?.output?.amount ??
    "0"
  );
};

export const getParaswapDeltaOutputAmount = (delta: ParaswapDeltaPrice) =>
  getDeltaAmount(delta, "destination.output");

export const getParaswapDeltaInputAmount = (delta: ParaswapDeltaPrice) =>
  getDeltaAmount(delta, "origin.input");

export const createParaswapDeltaTradeQuote = ({
  delta,
  inputAddress,
  marketPriceRoute,
  outputAddress,
  slippageBps,
  srcDecimals,
  destDecimals,
}: {
  delta: ParaswapDeltaPrice;
  inputAddress: string;
  marketPriceRoute?: ParaswapPriceRoute;
  outputAddress: string;
  slippageBps: number;
  srcDecimals: number;
  destDecimals: number;
}): ParaswapTradeQuote => {
  const outAmount = getParaswapDeltaOutputAmount(delta);
  const inAmount = getParaswapDeltaInputAmount(delta);
  const srcToken =
    delta.route.origin?.input?.token.address ??
    marketPriceRoute?.srcToken ??
    getParaswapTokenAddress(inputAddress);
  const destToken =
    delta.route.destination?.output?.token.address ??
    marketPriceRoute?.destToken ??
    getParaswapTokenAddress(outputAddress);

  return {
    provider: "paraswap",
    executionMode: "delta",
    outAmount,
    minAmountOut: getParaswapMinAmountOut(outAmount, slippageBps),
    inToken: inputAddress,
    outToken: outputAddress,
    inAmount,
    gas: "0",
    gasUsd: "0",
    timestamp: Date.now(),
    originalQuote: delta,
    delta,
    deltaRoute: delta.route,
    priceRoute: marketPriceRoute,
    marketPriceRoute,
    spender: delta.spender ?? "",
    srcToken,
    destToken,
    srcDecimals,
    destDecimals,
    slippageBps,
  };
};

export const isParaswapDeltaRoute = (
  value: unknown,
): value is ParaswapDeltaRoute =>
  Boolean(
    value &&
      typeof value === "object" &&
      (value as ParaswapDeltaRoute).origin?.input?.amount &&
      (value as ParaswapDeltaRoute).destination?.output?.amount,
  );

export const isParaswapDeltaTerminalStatus = (
  status?: string,
): status is ParaswapDeltaOrderStatus =>
  status === "COMPLETED" ||
  status === "FAILED" ||
  status === "EXPIRED" ||
  status === "CANCELLED" ||
  status === "REFUNDED";

export const isParaswapDeltaFailureStatus = (status?: string) =>
  status === "FAILED" ||
  status === "EXPIRED" ||
  status === "CANCELLED" ||
  status === "REFUNDED";

export const shouldTreatParaswapAsNoRoute = (status: number) =>
  status === 400 || status === 404 || status === 422;
