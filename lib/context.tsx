"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useDataChainId } from "./hooks/use-data-chain-id";
import { useSwapParams } from "./hooks/use-swap-params";

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const dataChainId = useDataChainId();
  const { setCurrencies } = useSwapParams();
  const chainRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (chainRef.current && chainRef.current !== dataChainId) {
      setCurrencies({ inputCurrency: undefined, outputCurrency: undefined });
    }

    if (dataChainId) {
      chainRef.current = dataChainId;
    }
  }, [dataChainId, setCurrencies]);

  return children;
};
