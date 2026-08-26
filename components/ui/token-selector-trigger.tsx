import { ChevronDownIcon } from "lucide-react";
import type { ComponentProps } from "react";

import type { Currency } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CurrencyLogo } from "./currency-logo";

type TokenSelectorTriggerProps = Omit<
  ComponentProps<"button">,
  "aria-label" | "children"
> & {
  "aria-label": string;
  chevronClassName?: string;
  currency?: Currency;
  fallbackClassName?: string;
  logoClassName?: string;
  logoUrl?: string;
  showChevron?: boolean;
  symbol?: string;
  symbolClassName?: string;
};

export function TokenSelectorTrigger({
  "aria-label": ariaLabel,
  chevronClassName,
  className,
  currency,
  fallbackClassName,
  logoClassName,
  logoUrl,
  showChevron,
  symbol,
  symbolClassName,
  type = "button",
  ...buttonProps
}: TokenSelectorTriggerProps) {
  const displaySymbol = symbol ?? currency?.symbol;

  return (
    <button
      {...buttonProps}
      type={type}
      aria-label={ariaLabel}
      data-token-selector-trigger
      data-no-card-focus
      className={cn(
        "inline-flex min-w-0 cursor-pointer items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35",
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
        <ChevronDownIcon
          aria-hidden="true"
          className={cn("size-4 shrink-0", chevronClassName)}
        />
      ) : null}
    </button>
  );
}
