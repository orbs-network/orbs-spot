import { ChevronDownIcon } from "lucide-react";

import type { Currency } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CurrencyLogo } from "./currency-logo";

export function TokenSelectorTrigger({
  chevronClassName,
  className,
  currency,
  fallbackClassName,
  logoClassName,
  logoUrl,
  showChevron,
  symbol,
  symbolClassName,
}: {
  chevronClassName?: string;
  className?: string;
  currency?: Currency;
  fallbackClassName?: string;
  logoClassName?: string;
  logoUrl?: string;
  showChevron?: boolean;
  symbol?: string;
  symbolClassName?: string;
}) {
  const displaySymbol = symbol ?? currency?.symbol;

  return (
    <span
      data-no-card-focus
      className={cn(
        "inline-flex min-w-0 cursor-pointer items-center rounded-full transition-colors",
        className,
      )}
    >
      <CurrencyLogo
        currency={currency}
        symbol={displaySymbol}
        logoUrl={logoUrl}
        className={cn("shrink-0", logoClassName)}
        fallbackClassName={fallbackClassName}
      />
      <span className={cn("min-w-0 truncate", symbolClassName)}>
        {displaySymbol}
      </span>
      {showChevron ? (
        <ChevronDownIcon className={cn("size-4 shrink-0", chevronClassName)} />
      ) : null}
    </span>
  );
}
