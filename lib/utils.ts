import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { Currency, USDPrices } from "./types";
import { Balances } from "./types";
import { formatUnits, getAddress, isAddress, parseUnits, zeroAddress } from "viem";
import { wCurrencies } from "./wrapped-currencies";
import {
  BASE_TOKENS,
  DEFAULT_CHAIN_ID,
  DEFAULT_TOKENS,
  hyperEvmChain,
  megaethChain,
  NATIVE_TOKENS_LOGO_URLS,
  POPULAR_TOKENS,
  SUPPORTED_CHAINS,
} from "./consts";
import * as chains from "viem/chains";

export const getBaseCurrencies = (chainId?: number) => {
  const targetChainId = chainId ?? DEFAULT_CHAIN_ID;
  const defaultTokens =
    DEFAULT_TOKENS[targetChainId as keyof typeof DEFAULT_TOKENS];
  const baseTokens =
    BASE_TOKENS[targetChainId as keyof typeof BASE_TOKENS] ??
    (chainId ? [] : BASE_TOKENS[DEFAULT_CHAIN_ID]);

  return uniqueTokenAddresses([
    defaultTokens?.input,
    defaultTokens?.output,
    ...baseTokens,
  ]);
};

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const eqCompare = (a: string, b: string) => {
  return a.toLowerCase() === b.toLowerCase();
};

export const isNativeAddress = (address?: string) => {
  return eqCompare(address ?? "", zeroAddress);
};

export const getTokenKey = (address?: string) => {
  if (!address) return "";
  if (isNativeAddress(address)) return zeroAddress;
  return isAddress(address) ? getAddress(address).toLowerCase() : address.toLowerCase();
};

export const uniqueTokenAddresses = (
  tokens: Array<string | null | undefined>
) => {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const token of tokens) {
    if (!token) continue;
    if (!isNativeAddress(token) && !isAddress(token)) continue;

    const key = getTokenKey(token);
    if (seen.has(key)) continue;

    seen.add(key);
    result.push(key);
  }

  return result;
};

export const dedupeCurrenciesByAddress = (currencies: Currency[]) => {
  const seen = new Set<string>();

  return currencies.filter((currency) => {
    const key = getTokenKey(currency.address);
    if (!key || seen.has(key)) return false;

    seen.add(key);
    return true;
  });
};

export const getWrappedNativeCurrency = (chainId?: number): Currency | undefined => {
  if(!chainId) return undefined;
  return wCurrencies[chainId];
};

const getBaseAssetRankMap = (chainId?: number) => {
  const ranks = new Map<string, number>([[zeroAddress, -1]]);

  getBaseCurrencies(chainId).forEach((address, index) => {
    const key = getTokenKey(address);
    if (!ranks.has(key)) {
      ranks.set(key, index);
    }
  });

  return ranks;
};

const COMMON_BASE_SYMBOL_RANKS = new Map(
  [
    "USDC",
    "USDCE",
    "USDBC",
    "USDT",
    "BSCUSD",
    "DAI",
    "WBTC",
    "WBTCE",
    "BTCB",
    "CBBTC",
    "BTC",
    "ETH",
    "WETH",
  ].map((symbol, index) => [symbol, index])
);

const CHAIN_NATIVE_SYMBOLS: Record<number, string[]> = {
  [chains.bsc.id]: ["BNB", "WBNB"],
  [chains.polygon.id]: ["POL", "WPOL", "MATIC", "WMATIC"],
  [chains.sonic.id]: ["S", "WS"],
  [chains.monad.id]: ["MON", "WMON"],
  [chains.mainnet.id]: ["ETH", "WETH"],
  [chains.arbitrum.id]: ["ETH", "WETH"],
  [chains.base.id]: ["ETH", "WETH"],
  [chains.linea.id]: ["ETH", "WETH"],
  [chains.sei.id]: ["SEI", "WSEI"],
  [chains.berachain.id]: ["BERA", "WBERA"],
  [chains.flare.id]: ["FLR", "WFLR"],
  [chains.avalanche.id]: ["AVAX", "WAVAX"],
  [chains.katana.id]: ["ETH", "WETH"],
  [chains.optimism.id]: ["ETH", "WETH"],
  [chains.mantle.id]: ["MNT", "WMNT"],
  [hyperEvmChain.id]: ["HYPE", "WHYPE"],
  [chains.unichain.id]: ["ETH", "WETH"],
  [chains.xLayer.id]: ["OKB", "WOKB"],
  [megaethChain.id]: ["ETH", "WETH"],
};

const getSymbolRank = (symbol?: string, chainId?: number) => {
  const normalizedSymbol = (symbol ?? "")
    .toUpperCase()
    .replace(/[.\-_\s]/g, "");
  const nativeSymbols = CHAIN_NATIVE_SYMBOLS[chainId ?? DEFAULT_CHAIN_ID] ?? [];
  const nativeRank = nativeSymbols.indexOf(normalizedSymbol);

  if (nativeRank !== -1) {
    return nativeRank;
  }

  const commonRank = COMMON_BASE_SYMBOL_RANKS.get(normalizedSymbol);
  return commonRank === undefined
    ? Number.POSITIVE_INFINITY
    : nativeSymbols.length + commonRank;
};

const getBaseAssetRank = (
  currency: Pick<Currency, "address" | "symbol">,
  chainId?: number,
  ranks = getBaseAssetRankMap(chainId)
) => {
  if (isNativeAddress(currency.address)) return -1;

  const tokenKey = getTokenKey(currency.address);
  const addressRank = ranks.get(tokenKey);
  if (addressRank !== undefined) {
    return addressRank;
  }

  return getSymbolRank(currency.symbol, chainId);
};

export const sortByBaseAssets = (currencies: Currency[], chainId?: number) => {
  const baseRanks = getBaseAssetRankMap(chainId);

  return [...currencies].sort((a, b) => {
    const baseRankA = getBaseAssetRank(a, chainId, baseRanks);
    const baseRankB = getBaseAssetRank(b, chainId, baseRanks);
    const baseA = baseRankA !== Number.POSITIVE_INFINITY;
    const baseB = baseRankB !== Number.POSITIVE_INFINITY;

    if (baseA !== baseB) {
      return baseA ? -1 : 1; // base first
    }

    if (!baseA || !baseB) return 0;

    return baseRankA - baseRankB;
  });
};

export const sortTokens = (
  currencies: Currency[],
  usdPrices?: USDPrices,
  balances?: Balances,
  chainId?: number
) => {
  const valueMap = new Map<string, number>();
  const hasBalanceMap = new Map<string, boolean>();
  const baseRankMap = getBaseAssetRankMap(chainId);
  const symbolRankMap = new Map<string, number>();

  for (const currency of currencies) {
    const key = getTokenKey(currency.address);
    const raw = balances?.[key]?.toString() ?? "0";
    const hasBalance = raw !== "0" && raw !== "";
    hasBalanceMap.set(key, hasBalance);
    symbolRankMap.set(key, getBaseAssetRank(currency, chainId, baseRankMap));

    if (!hasBalance) {
      valueMap.set(key, 0);
      continue;
    }

    const usdPrice = usdPrices?.[key] ?? usdPrices?.[currency.address] ?? 0;
    if (!usdPrice) {
      valueMap.set(key, 0);
      continue;
    }

    const balance = Number(formatUnits(BigInt(raw), currency.decimals));
    valueMap.set(key, balance * usdPrice);
  }

  const res = [...currencies].sort((a, b) => {
    const tokenA = getTokenKey(a.address);
    const tokenB = getTokenKey(b.address);
    const hasBalanceA = hasBalanceMap.get(tokenA) ?? false;
    const hasBalanceB = hasBalanceMap.get(tokenB) ?? false;
    if (hasBalanceA !== hasBalanceB) return hasBalanceA ? -1 : 1;

    const valueA = valueMap.get(tokenA) ?? 0;
    const valueB = valueMap.get(tokenB) ?? 0;
    if (valueA !== valueB) return valueB - valueA;

    const baseRankA = symbolRankMap.get(tokenA) ?? Number.POSITIVE_INFINITY;
    const baseRankB = symbolRankMap.get(tokenB) ?? Number.POSITIVE_INFINITY;
    const isBaseA = baseRankA !== Number.POSITIVE_INFINITY;
    const isBaseB = baseRankB !== Number.POSITIVE_INFINITY;

    if (isBaseA !== isBaseB) return isBaseA ? -1 : 1;
    if (baseRankA !== baseRankB) return baseRankA - baseRankB;

    return 0;
  });

  const seen = new Set<string>();
  const uniqueRes = res.filter((token) => {
    const key = getTokenKey(token.address);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
  const nativeIndex = uniqueRes.findIndex((t) => isNativeAddress(t.address));
  if (nativeIndex !== -1) {
    const native = uniqueRes[nativeIndex];
    uniqueRes.splice(nativeIndex, 1);
    uniqueRes.unshift(native);
  }

  return uniqueRes;
};

export function formatDecimals(
  value?: string,
  scale = 6,
  maxDecimals = 8
): string {
  if (!value) return "";

  // ─── keep the sign, work with the absolute value ────────────────
  const sign = value.startsWith("-") ? "-" : "";
  const abs = sign ? value.slice(1) : value;

  const [intPart, rawDec = ""] = abs.split(".");

  // Fast-path: decimal part is all zeros (or absent) ───────────────
  if (!rawDec || Number(rawDec) === 0) return sign + intPart;

  /** Case 1 – |value| ≥ 1 *****************************************/
  if (intPart !== "0") {
    const sliced = rawDec.slice(0, scale);
    const cleaned = sliced.replace(/0+$/, ""); // drop trailing zeros
    const trimmed = cleaned ? "." + cleaned : "";
    return sign + intPart + trimmed;
  }

  /** Case 2 – |value| < 1 *****************************************/
  const firstSigIdx = rawDec.search(/[^0]/); // first non-zero position
  if (firstSigIdx === -1) return "0"; // decimal part is all zeros
  if (firstSigIdx + 1 > maxDecimals) return "0"; // too many leading zeros → 0

  const leadingZeros = rawDec.slice(0, firstSigIdx); // keep them
  const significantRaw = rawDec.slice(firstSigIdx).slice(0, scale);
  const significant = significantRaw.replace(/0+$/, ""); // trim trailing zeros

  return significant ? sign + "0." + leadingZeros + significant : "0";
}

function normalizeDecimalString(value?: string) {
  if (!value || !/[eE]/.test(value)) return value;

  const [mantissa, exponentValue] = value.toLowerCase().split("e");
  const exponent = Number(exponentValue);
  if (!Number.isFinite(exponent)) return value;

  const sign = mantissa.startsWith("-") ? "-" : "";
  const unsignedMantissa = sign ? mantissa.slice(1) : mantissa;
  const [integerPart, decimalPart = ""] = unsignedMantissa.split(".");
  const digits = `${integerPart}${decimalPart}`.replace(/^0+(?=\d)/, "");
  const decimalIndex = integerPart.length + exponent;

  if (decimalIndex <= 0) {
    return `${sign}0.${"0".repeat(Math.abs(decimalIndex))}${digits}`;
  }

  if (decimalIndex >= digits.length) {
    return `${sign}${digits}${"0".repeat(decimalIndex - digits.length)}`;
  }

  return `${sign}${digits.slice(0, decimalIndex)}.${digits.slice(decimalIndex)}`;
}

export function dynamicDecimals(
  value?: string | number,
  scale = 3,
  maxDecimals = 12
): string {
  return formatDecimals(normalizeDecimalString(value?.toString()), scale, maxDecimals);
}

export const parseNativeCurrencyAddress = (
  address: string,
  chainId: number
) => {
  if (isNativeAddress(address)) {
    return getWrappedNativeCurrency(chainId)?.address ?? "";
  }
  return address;
};

export const getNativeTokenLogoUrl = (chainId: number) => {
  return (
    NATIVE_TOKENS_LOGO_URLS[chainId as keyof typeof NATIVE_TOKENS_LOGO_URLS] ??
    ""
  );
};

export const getDefaultTokensForChain = (chainId: number = DEFAULT_CHAIN_ID) => {
  const defaultTokens = DEFAULT_TOKENS[chainId as keyof typeof DEFAULT_TOKENS];

  if (defaultTokens) {
    return defaultTokens;
  }

  return DEFAULT_TOKENS[DEFAULT_CHAIN_ID];
};

export const getChainName = (chainId: number) => {
  return (
    SUPPORTED_CHAINS.find((chain) => chain.id === chainId)?.name ?? ""
  );
};

export const getPopularTokenForChain = (chainId?: number) => {
  if (!chainId) {
    return [];
  }
  return uniqueTokenAddresses(
    POPULAR_TOKENS[chainId as keyof typeof POPULAR_TOKENS] ?? []
  );
};

export const makeEllipsisAddress = (
  address?: string,
  padding?: { start: number; end: number }
): string => {
  if (!address) return "";
  return `${address.substring(0, padding?.start || 6)}...${address.substring(
    address.length - (padding?.end || 5)
  )}`;
};

export const getExplorerUrl = (chainId?: number, txHash?: string) => {
  if (!chainId || !txHash) {
    return "";
  }
  const explorer = SUPPORTED_CHAINS.find((chain) => chain.id === chainId)
    ?.blockExplorers?.default;
  if (!explorer) {
    return "";
  }
  return `${explorer.url}/tx/${txHash}`;
};

export const filterCurrencies = (
  currencies?: Currency[],
  query?: string[]
): Currency[] => {
  if (!currencies || !query || query.length === 0) return currencies ?? [];

  const keys: (keyof Currency)[] = ["name", "symbol", "address"];
  const normalizedQuery = query.map((q) => q.toLowerCase());

  return currencies.filter((currency) =>
    keys.some((key) => {
      const value = currency[key];
      if (typeof value !== "string") return false;

      const lowerValue = value.toLowerCase();

      return normalizedQuery.some((q) => lowerValue.includes(q));
    })
  );
};


export function getFirstAndLastLetter(symbol?: string): string {
  if (!symbol) return "";
  const s = symbol.trim().toUpperCase();
  return s.length <= 1 ? s : `${s[0]}${s[s.length - 1]}`;
}


export const toAmountWei = (value?: string, decimals?: number) => {
  if (!decimals || !value) return "0";
  return parseUnits(value, decimals).toString();
};

export const toAmountUI = (value?: string, decimals?: number) => {
 try {
  if (!decimals || !value) return "0";
  return formatUnits(BigInt(value), decimals);
 // eslint-disable-next-line @typescript-eslint/no-unused-vars
 } catch (error) {
  return "0";
 }
};
