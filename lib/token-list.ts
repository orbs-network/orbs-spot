import { getAddress, isAddress, zeroAddress } from "viem";
import type { Currency } from "./types";
import { normalizeTokenLogoUrl } from "./token-logos";

export const MAX_DEFAULT_TOKENS = 200;

export function parseTokenList(tokens: unknown[], chainId: number): Currency[] {
  return tokens.flatMap((token): Currency[] => {
    if (!token || typeof token !== "object") return [];
    const { address, decimals, name, symbol, logoURI, chainId: tokenChainId } = token as Record<string, unknown>;
    if (typeof address !== "string" || !isAddress(address, { strict: false }) ||
      address.toLowerCase() === zeroAddress ||
      (tokenChainId !== undefined && tokenChainId !== chainId) ||
      typeof name !== "string" || !name.trim() ||
      typeof symbol !== "string" || !symbol.trim() ||
      typeof decimals !== "number" || !Number.isInteger(decimals) || decimals < 0 || decimals > 255) return [];
    return [{ chainId, address: getAddress(address), decimals, name: name.trim(), symbol: symbol.trim(), logoUrl: normalizeTokenLogoUrl(logoURI) ?? "" }];
  });
}

/** Preserve canonical seed metadata, enriching it with every supplied logo.
 * Duplicate symbols are valid: identity is the chain and contract address. */
export function mergeTokenLists(currencies: readonly Currency[], chainId: number): Currency[] {
  const byAddress = new Map<string, Currency>();
  for (const currency of currencies) {
    const key = currency.address.toLowerCase();
    const previous = byAddress.get(key);
    const logos = [...new Set([
      previous?.logoUrl, ...(previous?.logoFallbackUrls ?? []),
      currency.logoUrl, ...(currency.logoFallbackUrls ?? []),
    ].map(normalizeTokenLogoUrl).filter((url): url is string => Boolean(url)))];
    byAddress.set(key, {
      ...(previous ?? currency), chainId, logoUrl: logos[0] ?? "",
      ...(logos.length > 1 ? { logoFallbackUrls: logos.slice(1) } : {}),
    });
  }
  return [...byAddress.values()];
}
