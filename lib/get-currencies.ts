import * as chains from "viem/chains";
import { Currency } from "./types";
import { getAddress, isAddress, zeroAddress } from "viem";
import axios from "axios";
import { SUPPORTED_CHAINS } from "./consts";
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
} satisfies Partial<Record<number, string>>;

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
          logoUrl: "",
          name: token.name!,
        }))
    );

    const tokensWithoutNativeSymbol = tokens.filter(
      (token: Currency) => !eqCompare(token.symbol, nativeCurrency?.symbol ?? "")
    );

    let res = sortByBaseAssets(tokensWithoutNativeSymbol, chainId);
    if (nativeToken) {
      res = [nativeToken, ...res];
    }
    return dedupeCurrenciesByAddress(res).slice(0, CURRENCY_LIST_LIMIT);
  } catch (error) {
    console.error("Error fetching tokens:", error);
    throw error;
  }
};
