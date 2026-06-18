import * as chains from "viem/chains";
import { Currency } from "./types";
import { getAddress, isAddress, zeroAddress } from "viem";
import axios from "axios";
import type { SupportedChainId } from "./consts";
import {
  dedupeCurrenciesByAddress,
  eqCompare,
  getNativeTokenLogoUrl,
  sortByBaseAssets,
} from "./utils";

const coingekoChainToName = {
  [chains.arbitrum.id]: "arbitrum-one",
  [chains.polygon.id]: "polygon-pos",
  [chains.base.id]: "base",
  [chains.mainnet.id]: "ethereum",
  [chains.bsc.id]: "binance-smart-chain",
  [chains.linea.id]: "linea",
  [chains.sonic.id]: "sonic",
  [chains.monad.id]: "monad",
} satisfies Record<SupportedChainId, string>;

type CoinGeckoToken = {
  address?: string;
  symbol?: string;
  decimals?: number;
  logoURI?: string;
  name?: string;
};

const CURRENCY_LIST_LIMIT = 350;

export const getCurrencies = async (
  chainId: number,
  signal?: AbortSignal
): Promise<Currency[]> => {
  try {
    const name =
      coingekoChainToName[chainId as keyof typeof coingekoChainToName];

    if (!name) {
      return [];
    }

    const response = await axios.get(
      `https://tokens.coingecko.com/${name}/all.json`,
      { signal }
    );

    const responseTokens = Array.isArray(response.data?.tokens)
      ? (response.data.tokens as CoinGeckoToken[])
      : [];

    const tokens = dedupeCurrenciesByAddress(
      responseTokens
        .filter(
          (token) =>
            typeof token.address === "string" &&
            isAddress(token.address) &&
            typeof token.symbol === "string" &&
            typeof token.name === "string" &&
            typeof token.decimals === "number"
        )
        .map((token) => ({
          address: getAddress(token.address!),
          symbol: token.symbol!,
          decimals: token.decimals!,
          logoUrl: token.logoURI ?? "",
          name: token.name!,
        }))
    );

    const _native = Object.values(chains).find(
      (chain) => chain.id === chainId
    )?.nativeCurrency;

    const tokensWithoutNativeSymbol = tokens.filter(
      (token: Currency) => !eqCompare(token.symbol, _native?.symbol ?? "")
    );

    let res = sortByBaseAssets(tokensWithoutNativeSymbol, chainId);
    if (_native) {
      res = [
        {
          address: zeroAddress,
          symbol: _native.symbol,
          decimals: _native.decimals,
          logoUrl: getNativeTokenLogoUrl(chainId),
          name: _native.name,
        },
        ...res,
      ];
    }
    return dedupeCurrenciesByAddress(res).slice(0, CURRENCY_LIST_LIMIT);
  } catch (error) {
    console.error("Error fetching tokens:", error);
    throw error;
  }
};
