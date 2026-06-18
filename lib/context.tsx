"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useConnection } from "wagmi";
import { useSwapParams } from "./hooks/use-swap-params";

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const { chainId } = useConnection();
  const { setCurrencies } = useSwapParams();
  const chainRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (chainRef.current && chainRef.current !== chainId) {
      setCurrencies({ inputCurrency: undefined, outputCurrency: undefined });
    }

    chainRef.current = chainId;
  }, [chainId, setCurrencies]);

  return children;
};
