import axios from "axios";
import { zeroAddress } from "viem";
import * as chains from "viem/chains";

import { ADDITIONAL_CHAIN_TOKENS } from "./additional-chain-tokens";
import { wCurrencies } from "./wrapped-currencies";
import { SUPPORTED_CHAINS } from "./consts";
import type { Currency } from "./types";
import { MAX_DEFAULT_TOKENS, mergeTokenLists, parseTokenList } from "./token-list";
import {
  getNativeTokenLogoUrl,
  sortByBaseAssets,
} from "./utils";

const coinGeckoChainNames: Readonly<Partial<Record<number, string>>> = {
  [chains.arbitrum.id]: "arbitrum-one",
  [chains.polygon.id]: "polygon-pos",
  [chains.base.id]: "base",
  [chains.mainnet.id]: "ethereum",
  [chains.bsc.id]: "binance-smart-chain",
  [chains.linea.id]: "linea",
  [chains.sei.id]: "sei-v2",
  [chains.berachain.id]: "berachain",
  [chains.flare.id]: "flare-network",
  [chains.sonic.id]: "sonic",
  [chains.monad.id]: "monad",
  [chains.avalanche.id]: "avalanche",
  [chains.katana.id]: "katana",
  [chains.optimism.id]: "optimistic-ethereum",
  [chains.mantle.id]: "mantle",
  [chains.hyperEvm.id]: "hyperevm",
  [chains.unichain.id]: "unichain",
  [chains.xLayer.id]: "x-layer",
  [chains.megaeth.id]: "megaeth",
  [chains.blast.id]: "blast",
  [chains.rootstock.id]: "rootstock",
  [chains.plasma.id]: "plasma",
  [chains.ink.id]: "ink",
};

export async function getCurrencies(
  chainId: number,
  signal?: AbortSignal,
): Promise<Currency[]> {
  const name = coinGeckoChainNames[chainId];
  const nativeCurrency = SUPPORTED_CHAINS.find(
    (chain) => chain.id === chainId,
  )?.nativeCurrency;
  const nativeToken = nativeCurrency
    ? {
        address: zeroAddress,
        symbol: nativeCurrency.symbol,
        decimals: nativeCurrency.decimals,
        logoUrl: getNativeTokenLogoUrl(chainId),
        name: nativeCurrency.name,
      }
    : undefined;

  const seedTokens = ADDITIONAL_CHAIN_TOKENS[chainId]
    ?? (wCurrencies[chainId] ? [wCurrencies[chainId]] : []);
  if (!name) {
    return sortByBaseAssets(mergeTokenLists(nativeToken ? [nativeToken, ...seedTokens] : seedTokens, chainId), chainId).slice(0, MAX_DEFAULT_TOKENS);
  }

  const response = await axios.get<{ tokens?: unknown[] }>(
    `https://tokens.coingecko.com/${name}/all.json`,
    { signal, timeout: 15_000 },
  );
  if (!Array.isArray(response.data?.tokens)) throw new Error("Invalid token list response");
  const tokens = mergeTokenLists([
    ...(nativeToken ? [nativeToken] : []),
    ...seedTokens,
    ...parseTokenList(response.data.tokens, chainId),
  ], chainId);

  // Keep native, default, and popular assets before trimming the remote list.
  // Other tokens remain available through contract-address import.
  return sortByBaseAssets(tokens, chainId).slice(0, MAX_DEFAULT_TOKENS);
}
