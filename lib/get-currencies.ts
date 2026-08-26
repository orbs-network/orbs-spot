import axios from "axios";
import { getAddress, isAddress, zeroAddress } from "viem";
import * as chains from "viem/chains";

import { SUPPORTED_CHAINS } from "./consts";
import type { Currency } from "./types";
import {
  dedupeCurrenciesByAddress,
  eqCompare,
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
};

type CoinGeckoToken = {
  address?: string;
  decimals?: number;
  logoURI?: string;
  name?: string;
  symbol?: string;
};

type ValidCoinGeckoToken = CoinGeckoToken & {
  address: string;
  decimals: number;
  name: string;
  symbol: string;
};

const CURRENCY_LIST_LIMIT = 350;

function isValidCoinGeckoToken(
  token: CoinGeckoToken,
): token is ValidCoinGeckoToken {
  return (
    typeof token.address === "string" &&
    isAddress(token.address) &&
    typeof token.symbol === "string" &&
    typeof token.name === "string" &&
    typeof token.decimals === "number"
  );
}

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

  if (!name) {
    return nativeToken ? [nativeToken] : [];
  }

  const response = await axios.get<{ tokens?: CoinGeckoToken[] }>(
    `https://tokens.coingecko.com/${name}/all.json`,
    { signal },
  );
  const responseTokens = Array.isArray(response.data.tokens)
    ? response.data.tokens
    : [];
  const tokens = dedupeCurrenciesByAddress(
    responseTokens.filter(isValidCoinGeckoToken).map((token) => ({
      address: getAddress(token.address),
      symbol: token.symbol,
      decimals: token.decimals,
      logoUrl: "",
      name: token.name,
    })),
  );
  const tokensWithoutNativeSymbol = tokens.filter(
    (token) => !eqCompare(token.symbol, nativeCurrency?.symbol ?? ""),
  );
  const sortedTokens = sortByBaseAssets(tokensWithoutNativeSymbol, chainId);
  const currencies = nativeToken
    ? [nativeToken, ...sortedTokens]
    : sortedTokens;

  return dedupeCurrenciesByAddress(currencies).slice(0, CURRENCY_LIST_LIMIT);
}
