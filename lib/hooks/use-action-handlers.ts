import { useCallback, useMemo } from "react";
import { useSwapParams } from "./use-swap-params";
import { Field } from "../types";
import { useSwapStore } from "./store";
import { eqCompare } from "../utils";

export const useActionHandlers = () => {
  const {
    setInputCurrency,
    setOutputCurrency,
    inputCurrency,
    outputCurrency,
    toggleCurrencies,
  } = useSwapParams();
  const setInputAmount = useSwapStore((state) => state.setInputAmount);

  const handleInputCurrencyChange = useCallback(
    (currency: string) => {
      if (eqCompare(currency, outputCurrency ?? "")) {
        toggleCurrencies();
      } else {
        setInputCurrency(currency);
      }
    },
    [outputCurrency, setInputCurrency, toggleCurrencies]
  );

  const handleOutputCurrencyChange = useCallback(
    (currency: string) => {
      if (eqCompare(currency, inputCurrency ?? "")) {
        toggleCurrencies();
      } else {
        setOutputCurrency(currency);
      }
    },
    [inputCurrency, setOutputCurrency, toggleCurrencies]
  );

  const handleCurrencyChange = useCallback(
    (currency: string, field: Field) => {
      if (field === Field.INPUT) {
        handleInputCurrencyChange(currency);
      } else {
        handleOutputCurrencyChange(currency);
      }
    },
    [handleInputCurrencyChange, handleOutputCurrencyChange]
  );

  return useMemo(
    () => ({
      handleCurrencyChange,
      handleToggleCurrencies: toggleCurrencies,
      setInputAmount,
    }),
    [handleCurrencyChange, setInputAmount, toggleCurrencies]
  );
};
