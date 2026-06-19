import { StringParam, useQueryParams } from "use-query-params";
import { useCallback, useMemo } from "react";
import { getDefaultTokensForChain } from "../utils";
import { useDataChainId } from "./use-data-chain-id";

export const useSwapParams = () => {
  const [currencies, setCurrencies] = useQueryParams({
    inputCurrency: StringParam,
    outputCurrency: StringParam,
  });

  const chainId = useDataChainId();
  const defaultTokens = useMemo(() => {
    if (!chainId) return undefined;
    return getDefaultTokensForChain(chainId);
  }, [chainId]);

  const effectiveInput = currencies.inputCurrency || defaultTokens?.input;
  const effectiveOutput = currencies.outputCurrency || defaultTokens?.output;

  const setInputCurrency = useCallback(
    (inputCurrency: string) => {
      setCurrencies({ ...currencies, inputCurrency });
    },
    [currencies, setCurrencies]
  );
  const setOutputCurrency = useCallback(
    (outputCurrency: string) => {
      setCurrencies({ ...currencies, outputCurrency });
    },
    [currencies, setCurrencies]
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
