"use client";

import { ExchangeRate } from "@/components/exchange-rate";
import { formatExchangeRate, getExchangeRatesFromPrice } from "@/lib/exchange-rates";

// Table prices stay in the order's original direction; previews can still invert.
export function OrderRateText({ value, inputSymbol, outputSymbol }: {
  value?: string;
  inputSymbol?: string;
  outputSymbol?: string;
}) {
  const rates = getExchangeRatesFromPrice(value);
  if (!rates || !inputSymbol || !outputSymbol) return <span>—</span>;
  return <span data-exchange-rate="forward" className="inline-block min-w-0 max-w-full py-1 [overflow-wrap:anywhere]">1 {inputSymbol} = {formatExchangeRate(rates.forward)} {outputSymbol}</span>;
}

export function OrderRate({ value, inputSymbol, outputSymbol }: {
  value?: string;
  inputSymbol?: string;
  outputSymbol?: string;
}) {
  return <ExchangeRate rates={getExchangeRatesFromPrice(value)} inputSymbol={inputSymbol} outputSymbol={outputSymbol} />;
}
