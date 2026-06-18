import { DEFAULT_PRICE_PROTECTION, DEFAULT_SLIPPAGE } from "../consts";
import { useUserStore } from "./store";
import { useMemo } from "react";

export const useSettings = () => {
  const slippage = useUserStore((state) => state.slippage);
  const slippageMode = useUserStore((state) => state.slippageMode);
  const setSlippage = useUserStore((state) => state.setSlippage);
  const priceProtection = useUserStore((state) => state.priceProtection);
  const priceProtectionMode = useUserStore((state) => state.priceProtectionMode);
  const setPriceProtection = useUserStore((state) => state.setPriceProtection);
  const resolvedSlippage = slippage ?? DEFAULT_SLIPPAGE;
  const resolvedPriceProtection = priceProtection ?? DEFAULT_PRICE_PROTECTION;
  const resolvedSlippageMode =
    slippageMode ?? (resolvedSlippage === DEFAULT_SLIPPAGE ? "auto" : "custom");
  const resolvedPriceProtectionMode =
    priceProtectionMode ??
    (resolvedPriceProtection === DEFAULT_PRICE_PROTECTION ? "auto" : "custom");

  return useMemo(
    () => ({
      slippage: resolvedSlippage,
      slippageMode: resolvedSlippageMode,
      setSlippage,
      priceProtection: resolvedPriceProtection,
      priceProtectionMode: resolvedPriceProtectionMode,
      setPriceProtection,
    }),
    [
      resolvedPriceProtection,
      resolvedPriceProtectionMode,
      resolvedSlippage,
      resolvedSlippageMode,
      setPriceProtection,
      setSlippage,
    ]
  );
};
