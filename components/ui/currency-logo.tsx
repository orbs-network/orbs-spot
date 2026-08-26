/* eslint-disable @next/next/no-img-element */
"use client";

import type { Currency } from "@/lib/types";
import { useCallback, useMemo, useState } from "react";
import { Avatar, AvatarFallback } from "./avatar";
import { cn, getFirstAndLastLetter } from "@/lib/utils";

type Props = {
  currency?: Currency;
  symbol?: string;
  logoUrl?: string;
  name?: string;
  className?: string;
  fallbackClassName?: string;
};

const EMPTY_FAILED_SOURCES = new Set<string>();
const FAILED_LOGO_SOURCES = new Set<string>();
const LOADED_LOGO_SOURCES = new Set<string>();

const TOKEN_LOGO_SYMBOL_ALIASES: Record<string, string> = {
  BSCUSD: "USDT",
  WBTC: "BTC",
  WBNB: "BNB",
  WETH: "ETH",
  WMATIC: "MATIC",
};

const TOKEN_LOGO_NAME_HINTS = [
  "USDT",
  "USDC",
  "DAI",
  "WETH",
  "WBTC",
  "WBNB",
  "ETH",
  "BTC",
  "BNB",
  "MATIC",
  "POL",
  "AVAX",
  "SOL",
] as const;

function normalizeLogoSymbol(symbol?: string) {
  return (symbol ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function stripSymbolPrefix(symbol?: string) {
  const text = symbol?.trim() ?? "";
  const [, ...withoutPrefix] = text.split("-");

  return withoutPrefix.length ? withoutPrefix.join("-") : text;
}

function getLogoAlias(symbol: string) {
  const explicitAlias = TOKEN_LOGO_SYMBOL_ALIASES[symbol];
  if (explicitAlias) return explicitAlias;

  const multiplierMatch = symbol.match(/^(?:1000000|1000|1M)([A-Z0-9]+)$/);
  return multiplierMatch?.[1];
}

function getNameLogoHint(name?: string) {
  const normalizedName = normalizeLogoSymbol(name);

  return TOKEN_LOGO_NAME_HINTS.find((hint) => normalizedName.includes(hint));
}

function isCoinGeckoLogoUrl(url?: string) {
  if (!url) return false;

  try {
    return new URL(url).hostname.toLowerCase().includes("coingecko");
  } catch {
    return url.toLowerCase().includes("coingecko");
  }
}

function uniqueLogoUrls(urls: Array<string | undefined>) {
  return [
    ...new Set(
      urls.filter(
        (url): url is string => Boolean(url) && !isCoinGeckoLogoUrl(url),
      ),
    ),
  ];
}

function uniqueLogoSymbols(symbols: Array<string | undefined>) {
  return [
    ...new Set(symbols.map(normalizeLogoSymbol).filter(Boolean)),
  ];
}

function getFallbackLogoUrls(symbol?: string, name?: string) {
  const normalizedSymbols = uniqueLogoSymbols([
    getNameLogoHint(name),
    symbol,
    stripSymbolPrefix(symbol),
  ]);
  const lookupSymbols = [
    ...new Set(
      normalizedSymbols.flatMap((lookupSymbol) => {
        const alias = getLogoAlias(lookupSymbol);
        return alias ? [alias, lookupSymbol] : [lookupSymbol];
      }),
    ),
  ];

  return lookupSymbols.flatMap((lookupSymbol) => [
    `https://assets.coincap.io/assets/icons/${lookupSymbol.toLowerCase()}@2x.png`,
    `https://intentx-cdn.fra1.cdn.digitaloceanspaces.com/coins/${lookupSymbol.toLowerCase()}.png`,
    `https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/${lookupSymbol.toLowerCase()}.svg`,
    `https://app.hyperliquid.xyz/coins/${lookupSymbol}.svg`,
  ]);
}

function CurrencyLogoImage({
  alt,
  isLoaded,
  onLoad,
  src,
  onError,
}: {
  alt: string;
  isLoaded: boolean;
  onLoad: () => void;
  src?: string;
  onError: () => void;
}) {
  if (!src) return null;

  return (
    <img
      key={src}
      src={src}
      alt={alt}
      width={40}
      height={40}
      decoding="async"
      onLoad={onLoad}
      onError={onError}
      className={cn(
        "absolute inset-0 z-10 aspect-square size-full rounded-full object-contain",
        isLoaded ? "opacity-100" : "opacity-0"
      )}
    />
  );
}

export function CurrencyLogo({
  currency,
  symbol,
  logoUrl,
  name,
  className,
  fallbackClassName,
}: Props) {
  const displaySymbol = symbol ?? currency?.symbol ?? "";
  const displayName = name ?? currency?.name ?? displaySymbol;
  const logoSources = useMemo(
    () =>
      uniqueLogoUrls([
        logoUrl ?? currency?.logoUrl,
        ...getFallbackLogoUrls(displaySymbol, displayName),
      ]),
    [currency?.logoUrl, displayName, displaySymbol, logoUrl]
  );
  const logoSourcesKey = logoSources.join("\n");
  const [failedState, setFailedState] = useState<{
    key: string;
    sources: Set<string>;
  }>(() => ({ key: "", sources: new Set() }));
  const [loadedState, setLoadedState] = useState<{
    src?: string;
    loaded: boolean;
  }>(() => ({ loaded: false }));
  const failedSources =
    failedState.key === logoSourcesKey
      ? failedState.sources
      : EMPTY_FAILED_SOURCES;
  const activeLogoSource = useMemo(
    () =>
      logoSources.find(
        (source) =>
          !failedSources.has(source) && !FAILED_LOGO_SOURCES.has(source)
      ),
    [failedSources, logoSources]
  );
  const isLogoLoaded = activeLogoSource
    ? LOADED_LOGO_SOURCES.has(activeLogoSource) ||
      (loadedState.src === activeLogoSource && loadedState.loaded)
    : false;
  const onLogoLoad = useCallback(() => {
    if (!activeLogoSource) return;
    LOADED_LOGO_SOURCES.add(activeLogoSource);
    setLoadedState({ src: activeLogoSource, loaded: true });
  }, [activeLogoSource]);
  const onLogoError = useCallback(() => {
    if (!activeLogoSource) return;
    FAILED_LOGO_SOURCES.add(activeLogoSource);
    setLoadedState({ src: activeLogoSource, loaded: false });
    setFailedState((current) => {
      const sources =
        current.key === logoSourcesKey
          ? new Set(current.sources)
          : new Set<string>();
      sources.add(activeLogoSource);
      return { key: logoSourcesKey, sources };
    });
  }, [activeLogoSource, logoSourcesKey]);

  return (
    <Avatar className={cn("size-8", className)}>
      {(!activeLogoSource || !isLogoLoaded) && (
        <AvatarFallback
          className={cn(
            "absolute inset-0 z-0 flex h-full w-full items-center justify-center rounded-full bg-accent text-xs",
            fallbackClassName
          )}
        >
          {getFirstAndLastLetter(displaySymbol)}
        </AvatarFallback>
      )}
      <CurrencyLogoImage
        key={logoSourcesKey}
        alt={displayName}
        isLoaded={isLogoLoaded}
        src={activeLogoSource}
        onLoad={onLogoLoad}
        onError={onLogoError}
      />
    </Avatar>
  );
}
