import { getAddress, isAddress, zeroAddress } from "viem";
import type { Currency } from "./types";

// Trust Wallet directories are chain-specific; an address alone isn't identity.
const ASSET_CHAINS: Readonly<Partial<Record<number, string>>> = {
  1: "ethereum", 10: "optimism", 30: "rootstock", 56: "smartchain",
  137: "polygon", 143: "monad", 146: "sonic", 999: "hyperevm",
  1329: "seievm", 4326: "megaeth", 5000: "mantle", 8453: "base",
  9745: "plasma", 42161: "arbitrum", 43114: "avalanchec",
  59144: "linea", 81457: "blast",
};

export function normalizeTokenLogoUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const url = value.trim();
  if (url.startsWith("/") && !url.startsWith("//")) return url;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.href : undefined;
  } catch {
    return undefined;
  }
}

/** Compensate for padding baked into these WETH assets without changing artwork. */
export function getTokenLogoScale(src?: string): number {
  return src && (
    /^https:\/\/tokens-data\.1inch\.io\/images\/0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2\.png(?:\?|$)/i.test(src) ||
    /^https:\/\/assets\.coingecko\.com\/coins\/images\/39713\/(?:thumb|small|large)\/WETH\.PNG(?:\?|$)/i.test(src)
  ) ? 1.5 : 1;
}

export function getTokenLogoSources({ currency, logoUrl }: { currency?: Currency; logoUrl?: string }): string[] {
  const chain = currency?.chainId ? ASSET_CHAINS[currency.chainId] : undefined;
  const address = currency?.address;
  const assetLogo = chain && address && isAddress(address, { strict: false })
    ? address.toLowerCase() === zeroAddress
      ? `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${chain}/info/logo.png`
      : `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${chain}/assets/${getAddress(address)}/logo.png`
    : undefined;
  return [...new Set([logoUrl, currency?.logoUrl, ...(currency?.logoFallbackUrls ?? []), assetLogo]
    .map(normalizeTokenLogoUrl).filter((url): url is string => Boolean(url)))];
}

/** Avoid repeated broken-image requests while scrolling, but retry transient
 * failures on a later mount. Bound the cache even across very large lists. */
export function createLogoFailureCache(ttl = 60_000, limit = 512) {
  const failures = new Map<string, number>();
  return {
    has(source: string, now = Date.now()) {
      const until = failures.get(source);
      if (until === undefined) return false;
      if (until > now) return true;
      failures.delete(source);
      return false;
    },
    add(source: string, now = Date.now()) {
      failures.delete(source);
      failures.set(source, now + ttl);
      if (failures.size > limit) failures.delete(failures.keys().next().value!);
    },
  };
}
