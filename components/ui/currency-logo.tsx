/* eslint-disable @next/next/no-img-element */
"use client";

import { createLogoFailureCache, getTokenLogoScale, getTokenLogoSources } from "@/lib/token-logos";
import type { Currency } from "@/lib/types";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { Avatar, AvatarFallback } from "./avatar";
import { cn, getFirstAndLastLetter } from "@/lib/utils";

type Props = {
  currency?: Currency;
  symbol?: string;
  logoUrl?: string;
  name?: string;
  className?: string;
  fallbackClassName?: string;
  loadingFallback?: ReactNode;
};

const EMPTY_FAILED_SOURCES = new Set<string>();
const FAILED_LOGO_SOURCES = createLogoFailureCache();

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
  const scale = getTokenLogoScale(src);

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
      style={scale === 1 ? undefined : { transform: `scale(${scale})` }}
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
  loadingFallback,
}: Props) {
  const displaySymbol = symbol ?? currency?.symbol ?? "";
  const displayName = name ?? currency?.name ?? displaySymbol;
  const logoSources = useMemo(
    () => getTokenLogoSources({ currency, logoUrl }),
    [currency, logoUrl],
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
    ? (loadedState.src === activeLogoSource && loadedState.loaded)
    : false;
  const onLogoLoad = useCallback(() => {
    if (!activeLogoSource) return;
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
    <Avatar className={cn("size-8", className)} aria-busy={Boolean(loadingFallback && activeLogoSource && !isLogoLoaded) || undefined}>
      {(!activeLogoSource || !isLogoLoaded) && (
        activeLogoSource && loadingFallback ? loadingFallback : <AvatarFallback
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
