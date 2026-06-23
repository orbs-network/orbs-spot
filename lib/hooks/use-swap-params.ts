import { useCallback, useMemo } from "react";
import { getDefaultTokensForChain } from "../utils";
import { useDataChainId } from "./use-data-chain-id";
import { usePathname, useSearchParams } from "next/navigation";
import { pushUrlState } from "../url-state";

type CurrencyParams = {
  inputCurrency?: string;
  outputCurrency?: string;
};

export const useSwapParams = () => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currencies = useMemo(
    () => ({
      inputCurrency: searchParams.get("inputCurrency") ?? undefined,
      outputCurrency: searchParams.get("outputCurrency") ?? undefined,
    }),
    [searchParams],
  );

  const chainId = useDataChainId();
  const defaultTokens = useMemo(() => {
    if (!chainId) return undefined;
    return getDefaultTokensForChain(chainId);
  }, [chainId]);

  const effectiveInput = currencies.inputCurrency || defaultTokens?.input;
  const effectiveOutput = currencies.outputCurrency || defaultTokens?.output;

  const setCurrencies = useCallback(
    (updates: CurrencyParams) => {
      const nextParams = new URLSearchParams(searchParams.toString());

      for (const [key, value] of Object.entries(updates)) {
        if (value) {
          nextParams.set(key, value);
        } else {
          nextParams.delete(key);
        }
      }

      const queryString = nextParams.toString();
      const hash =
        typeof window === "undefined" ? "" : window.location.hash;
      const href = `${pathname}${queryString ? `?${queryString}` : ""}${hash}`;

      pushUrlState(href);
    },
    [pathname, searchParams],
  );

  const setInputCurrency = useCallback(
    (inputCurrency: string) => {
      setCurrencies({ inputCurrency });
    },
    [setCurrencies]
  );
  const setOutputCurrency = useCallback(
    (outputCurrency: string) => {
      setCurrencies({ outputCurrency });
    },
    [setCurrencies]
  );

  const toggleCurrencies = useCallback(() => {
    setCurrencies({
      inputCurrency: effectiveOutput,
      outputCurrency: effectiveInput,
    });
  }, [effectiveInput, effectiveOutput, setCurrencies]);

  return useMemo(
    () => ({
      inputCurrency: effectiveInput,
      setInputCurrency,
      outputCurrency: effectiveOutput,
      setOutputCurrency,
      toggleCurrencies,
      setCurrencies,
    }),
    [
      effectiveInput,
      effectiveOutput,
      setCurrencies,
      setInputCurrency,
      setOutputCurrency,
      toggleCurrencies,
    ]
  );
};
