import { CurrencyLogo } from "./currency-logo";
import { cn } from "@/lib/utils";
import type { Currency } from "@/lib/types";

export function SwapFlowTokenLogo({
  className,
  currency,
  token,
}: {
  className?: string;
  currency?: Currency;
  token?: {
    logoUrl?: string;
    name?: string;
    symbol?: string;
  };
}) {
  return (
    <CurrencyLogo
      currency={currency}
      name={token?.name ?? currency?.name}
      symbol={token?.symbol}
      logoUrl={token?.logoUrl}
      className={cn("token-logo", className)}
    />
  );
}
