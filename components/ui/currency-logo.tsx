/* eslint-disable @next/next/no-img-element */
"use client";

import { Currency } from "@/lib/types";
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

const TOKEN_LOGO_SYMBOL_ALIASES: Record<string, string> = {
  WBTC: "BTC",
  WBNB: "BNB",
  WETH: "ETH",
  WMATIC: "MATIC",
};

function normalizeLogoSymbol(symbol?: string) {
  return (symbol ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function getLogoAlias(symbol: string) {
  const explicitAlias = TOKEN_LOGO_SYMBOL_ALIASES[symbol];
  if (explicitAlias) return explicitAlias;

  const multiplierMatch = symbol.match(/^(?:1000000|1000|1M)([A-Z0-9]+)$/);
  return multiplierMatch?.[1];
}

function uniqueLogoUrls(urls: Array<string | undefined>) {
  return [...new Set(urls.filter((url): url is string => Boolean(url)))];
}

function getFallbackLogoUrls(symbol?: string) {
  const normalizedSymbol = normalizeLogoSymbol(symbol);
  if (!normalizedSymbol) return [];

  const alias = getLogoAlias(normalizedSymbol);
  const lookupSymbols = alias ? [alias, normalizedSymbol] : [normalizedSymbol];

  return lookupSymbols.flatMap((lookupSymbol) => [
    `https://intentx-cdn.fra1.cdn.digitaloceanspaces.com/coins/${lookupSymbol.toLowerCase()}.png`,
    `https://assets.coincap.io/assets/icons/${lookupSymbol.toLowerCase()}@2x.png`,
    `https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/${lookupSymbol.toLowerCase()}.svg`,
    `https://app.hyperliquid.xyz/coins/${lookupSymbol}.svg`,
  ]);
}

function CurrencyLogoImage({
  alt,
  src,
  onError,
}: {
  alt: string;
  src?: string;
  onError: () => void;
}) {
  if (!src) return null;

  return (
    <img
      key={src}
      src={src}
      alt={alt}
      onError={onError}
      className="absolute inset-0 z-10 aspect-square size-full rounded-full object-contain"
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
    () => uniqueLogoUrls([logoUrl ?? currency?.logoUrl, ...getFallbackLogoUrls(displaySymbol)]),
    [currency?.logoUrl, displaySymbol, logoUrl]
  );
  const logoSourcesKey = logoSources.join("\n");
  const [failedState, setFailedState] = useState<{
    key: string;
    sources: Set<string>;
  }>(() => ({ key: "", sources: new Set() }));
  const failedSources =
    failedState.key === logoSourcesKey
      ? failedState.sources
      : EMPTY_FAILED_SOURCES;
  const activeLogoSource = useMemo(
    () => logoSources.find((source) => !failedSources.has(source)),
    [failedSources, logoSources]
  );
  const onLogoError = useCallback(() => {
    if (!activeLogoSource) return;
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
    <Avatar className={cn("size-10", className)}>
      <CurrencyLogoImage
        key={logoSourcesKey}
        alt={displayName}
        src={activeLogoSource}
        onError={onLogoError}
      />
      {!activeLogoSource && (
        <AvatarFallback
          className={cn(
            "absolute inset-0 z-0 flex h-full w-full items-center justify-center rounded-full bg-accent text-xs",
            fallbackClassName
          )}
        >
          {getFirstAndLastLetter(displaySymbol)}
        </AvatarFallback>
      )}
    </Avatar>
  );
}
