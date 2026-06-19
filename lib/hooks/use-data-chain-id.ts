import { useEffect, useMemo, useState } from "react";
import { useConnection } from "wagmi";
import { DEFAULT_CHAIN_ID } from "../consts";

const DEFAULT_CHAIN_FALLBACK_DELAY = 150;

export const useDataChainId = () => {
  const { chainId } = useConnection();
  const [canUseDefaultChain, setCanUseDefaultChain] = useState(false);

  useEffect(() => {
    if (chainId) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setCanUseDefaultChain(true);
    }, DEFAULT_CHAIN_FALLBACK_DELAY);

    return () => window.clearTimeout(timeout);
  }, [chainId]);

  return useMemo(
    () => chainId ?? (canUseDefaultChain ? DEFAULT_CHAIN_ID : undefined),
    [canUseDefaultChain, chainId],
  );
};
