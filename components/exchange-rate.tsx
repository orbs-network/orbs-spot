"use client";

import { formatExchangeRate, type ExchangeRates } from "@/lib/exchange-rates";
import { formatDisplayAmount } from "@/lib/token-display";
import { cn } from "@/lib/utils";
import { useState } from "react";

type RateToken = { address: string; symbol: string };
type ExchangeRateProps = {
  rates?: ExchangeRates;
  inputSymbol?: string;
  outputSymbol?: string;
  forwardUsd?: string;
  reverseUsd?: string;
  className?: string;
};

export function TokenExchangeRate({ rates, inputCurrency, outputCurrency, inputTokenUsdPrice, outputTokenUsdPrice, className }: {
  rates?: ExchangeRates;
  inputCurrency?: RateToken;
  outputCurrency?: RateToken;
  inputTokenUsdPrice?: string;
  outputTokenUsdPrice?: string;
  className?: string;
}) {
  const forwardUsd = rates && outputTokenUsdPrice
    ? formatDisplayAmount(rates.forward.times(outputTokenUsdPrice).toFixed(), { decimalScale: 2, prefix: "$" })
    : undefined;
  const reverseUsd = rates && inputTokenUsdPrice
    ? formatDisplayAmount(rates.reverse.times(inputTokenUsdPrice).toFixed(), { decimalScale: 2, prefix: "$" })
    : undefined;
  return <ExchangeRate key={`${inputCurrency?.address}:${outputCurrency?.address}`} rates={rates} inputSymbol={inputCurrency?.symbol} outputSymbol={outputCurrency?.symbol} forwardUsd={forwardUsd} reverseUsd={reverseUsd} className={className} />;
}

export function ExchangeRate({ rates, inputSymbol, outputSymbol, forwardUsd, reverseUsd, className }: ExchangeRateProps) {
  const [inverted, setInverted] = useState(false);
  if (!rates || !inputSymbol || !outputSymbol) return <span className={className}>—</span>;
  const { direction, from, to, rate, usd } = inverted
    ? { direction: "reverse", from: outputSymbol, to: inputSymbol, rate: rates.reverse, usd: reverseUsd }
    : { direction: "forward", from: inputSymbol, to: outputSymbol, rate: rates.forward, usd: forwardUsd };
  const rateText = `1 ${from} = ${formatExchangeRate(rate)} ${to}`;

  return (
    <button
      type="button"
      data-exchange-rates
      data-hover="text"
      aria-label={`Invert rate: ${rateText}`}
      title="Click to invert rate"
      onClick={() => setInverted(value => !value)}
      className={cn("group/rate inline-flex min-h-6 min-w-0 max-w-full cursor-pointer items-center rounded-sm bg-transparent py-1 [text-align:inherit] hover:text-primary focus-visible:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary max-sm:min-h-11", className)}
    >
      <span data-exchange-rate={direction} className="min-w-0 [overflow-wrap:anywhere]">
        <span>{rateText}</span>
        {usd && (
          <>{" "}<span className="text-muted-foreground group-hover/rate:text-primary group-focus-visible/rate:text-primary">({usd})</span></>
        )}
      </span>
    </button>
  );
}
