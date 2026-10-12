import { createPublicClient, erc20Abi, getAddress, http, isAddress } from "viem";
import { queryOptions, type QueryClient } from "@tanstack/react-query";
import type { Order } from "@orbs-network/spot-ui";
import { SUPPORTED_CHAINS } from "@/lib/consts";
import type { Currency } from "@/lib/types";
import { getNativeTokenLogoUrl, isNativeAddress } from "@/lib/utils";

export type OrderToken = {
  chainId: number;
  address: `0x${string}`;
  symbol?: string;
  decimals?: number;
};
export type HistoryOrder = Order & { inputToken?: OrderToken; outputToken?: OrderToken };

const METADATA_STALE_TIME = 24 * 60 * 60_000;
const FAILED_METADATA_STALE_TIME = 60_000;
const metadataKey = (token: OrderToken) => ["spot-order-token", token.chainId, token.address.toLowerCase()] as const;
const tokenKey = (chainId: number, address: string) => `${chainId}:${address.toLowerCase()}`;
const complete = (token: OrderToken) => token.symbol !== undefined && token.decimals !== undefined;

export function getOrderTokens(orders: Order[]): OrderToken[] {
  const tokens = new Map<string, OrderToken>();
  for (const order of orders) {
    for (const address of [order.srcTokenAddress, order.dstTokenAddress]) {
      if (isAddress(address)) tokens.set(tokenKey(order.chainId, address), { chainId: order.chainId, address: getAddress(address) });
    }
  }
  return [...tokens.values()].sort((a, b) => a.chainId - b.chainId || a.address.localeCompare(b.address));
}

function nativeToken(token: OrderToken): OrderToken | undefined {
  if (!isNativeAddress(token.address)) return undefined;
  const currency = SUPPORTED_CHAINS.find(chain => chain.id === token.chainId)?.nativeCurrency;
  return { ...token, symbol: currency?.symbol, decimals: currency?.decimals };
}

/** One multicall per chain reads both fields for each distinct ERC-20 token. */
async function readTokens(tokens: OrderToken[], signal: AbortSignal): Promise<OrderToken[]> {
  const chain = SUPPORTED_CHAINS.find(chain => chain.id === tokens[0].chainId);
  if (!chain) throw new Error("Unsupported token network");
  const client = createPublicClient({
    chain,
    transport: http(`/api/rpc?chainId=${chain.id}`, { timeout: 10_000, retryCount: 0, fetchOptions: { signal } }),
  });
  const results = await client.multicall({
    allowFailure: true,
    contracts: tokens.flatMap(token => [
      { address: token.address, abi: erc20Abi, functionName: "symbol" },
      { address: token.address, abi: erc20Abi, functionName: "decimals" },
    ] as const),
  });
  return tokens.map((token, index) => {
    const symbol = results[index * 2].result;
    const decimals = results[index * 2 + 1].result;
    return {
      ...token,
      symbol: typeof symbol === "string" && symbol.trim() ? symbol.trim() : undefined,
      decimals: typeof decimals === "number" && Number.isInteger(decimals) && decimals >= 0 && decimals <= 255 ? decimals : undefined,
    };
  });
}

/** Rows and previews share the individual entries seeded by batched history reads. */
export function orderTokenQueryOptions(token: OrderToken) {
  return queryOptions({
    queryKey: metadataKey(token),
    queryFn: async ({ signal }) => nativeToken(token) ?? (await readTokens([token], signal))[0],
    staleTime: query => query.state.data && complete(query.state.data) ? METADATA_STALE_TIME : FAILED_METADATA_STALE_TIME,
    gcTime: 30 * 60_000,
    retry: false,
  });
}

export function orderTokensQueryOptions(queryClient: QueryClient, tokens: OrderToken[]) {
  return queryOptions({
    queryKey: ["spot-order-tokens", tokens.map(token => tokenKey(token.chainId, token.address))],
    queryFn: async ({ signal }) => {
      queryClient.setQueryDefaults(["spot-order-token"], { gcTime: 30 * 60_000 });
      const metadata = new Map<string, OrderToken>();
      const missing = new Map<number, OrderToken[]>();
      for (const token of tokens) {
        const cached = queryClient.getQueryState<OrderToken>(metadataKey(token));
        const staleTime = cached?.data && complete(cached.data) ? METADATA_STALE_TIME : FAILED_METADATA_STALE_TIME;
        const known = nativeToken(token) ?? (cached?.data && Date.now() - cached.dataUpdatedAt < staleTime ? cached.data : undefined);
        if (known) metadata.set(tokenKey(token.chainId, token.address), known);
        else {
          const group = missing.get(token.chainId) ?? [];
          group.push(token);
          missing.set(token.chainId, group);
        }
      }
      const groups = [...missing.values()];
      const results = await Promise.allSettled(groups.map(group => readTokens(group, signal)));
      signal.throwIfAborted();
      results.forEach((result, index) => {
        // A failed network or individual contract leaves address-only metadata.
        const resolved = result.status === "fulfilled" ? result.value : groups[index];
        resolved.forEach(token => {
          queryClient.setQueryData(metadataKey(token), token);
          metadata.set(tokenKey(token.chainId, token.address), token);
        });
      });
      return tokens.map(token => metadata.get(tokenKey(token.chainId, token.address)) ?? token);
    },
    staleTime: query => query.state.data?.every(complete) ? METADATA_STALE_TIME : FAILED_METADATA_STALE_TIME,
    gcTime: 30 * 60_000,
    retry: false,
  });
}

export function withOrderTokens(orders: HistoryOrder[], tokens: OrderToken[]): HistoryOrder[] {
  const metadata = new Map(tokens.map(token => [tokenKey(token.chainId, token.address), token]));
  return orders.map(order => {
    const inputToken = metadata.get(tokenKey(order.chainId, order.srcTokenAddress)) ?? order.inputToken;
    const outputToken = metadata.get(tokenKey(order.chainId, order.dstTokenAddress)) ?? order.outputToken;
    return inputToken === order.inputToken && outputToken === order.outputToken ? order : { ...order, inputToken, outputToken };
  });
}

/** Missing decimals must never turn into a guessed amount conversion. */
export function orderTokenCurrency(token?: OrderToken): Currency | undefined {
  if (token?.decimals === undefined) return undefined;
  return { ...token, decimals: token.decimals, symbol: token.symbol ?? "", name: token.symbol ?? "", logoUrl: isNativeAddress(token.address) ? getNativeTokenLogoUrl(token.chainId) : "" };
}
