import { useEffect, useMemo, useState } from "react";
import { useConnection } from "wagmi";
import {
  BASE_TOKENS,
  DEFAULT_CHAIN_ID,
  DEFAULT_TOKENS,
  SUPPORTED_CHAINS,
} from "../consts";
import { getTokenKey } from "../utils";

const DEFAULT_CHAIN_FALLBACK_DELAY = 150;
const LAST_DATA_CHAIN_ID_STORAGE_KEY = "swap-last-data-chain-id";

const supportedChainIds: ReadonlySet<number> = new Set(
  SUPPORTED_CHAINS.map((chain) => chain.id),
);

const tokenChainIds = new Map<string, Set<number>>();

for (const chain of SUPPORTED_CHAINS) {
  const defaultTokens = DEFAULT_TOKENS[chain.id];
  const knownTokens = [
    defaultTokens?.input,
    defaultTokens?.output,
    ...(BASE_TOKENS[chain.id] ?? []),
  ];

  for (const token of knownTokens) {
    const key = getTokenKey(token);
    if (!key) continue;

    const chainIds = tokenChainIds.get(key) ?? new Set<number>();
    chainIds.add(chain.id);
    tokenChainIds.set(key, chainIds);
  }
}

function getStoredChainId() {
  if (typeof window === "undefined") return undefined;

  const value = Number(window.localStorage.getItem(LAST_DATA_CHAIN_ID_STORAGE_KEY));
  return supportedChainIds.has(value) ? value : undefined;
}

function inferChainIdFromTokenParams() {
  if (typeof window === "undefined") return undefined;

  const params = new URLSearchParams(window.location.search);
  const tokens = [
    params.get("inputCurrency"),
    params.get("outputCurrency"),
  ].map((token) => getTokenKey(token ?? undefined)).filter(Boolean);

  let candidates: Set<number> | undefined;

  for (const token of tokens) {
    const chainIds = tokenChainIds.get(token);
    if (!chainIds?.size) continue;

    if (!candidates) {
      candidates = new Set(chainIds);
      continue;
    }

    candidates = new Set(
      [...candidates].filter((chainId) => chainIds.has(chainId)),
    );
  }

  return candidates?.size === 1 ? [...candidates][0] : undefined;
}

function getInitialFallbackChainId() {
  return inferChainIdFromTokenParams() ?? getStoredChainId();
}

export const useDataChainId = () => {
  const { chainId } = useConnection();
  const [fallbackChainId] = useState(getInitialFallbackChainId);
  const [canUseDefaultChain, setCanUseDefaultChain] = useState(false);

  useEffect(() => {
    if (!chainId) return;

    if (supportedChainIds.has(chainId)) {
      window.localStorage.setItem(
        LAST_DATA_CHAIN_ID_STORAGE_KEY,
        chainId.toString(),
      );
    }
  }, [chainId]);

  useEffect(() => {
    if (chainId || fallbackChainId) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setCanUseDefaultChain(true);
    }, DEFAULT_CHAIN_FALLBACK_DELAY);

    return () => window.clearTimeout(timeout);
  }, [chainId, fallbackChainId]);

  return useMemo(
    () =>
      chainId ??
      fallbackChainId ??
      (canUseDefaultChain ? DEFAULT_CHAIN_ID : undefined),
    [canUseDefaultChain, chainId, fallbackChainId],
  );
};
