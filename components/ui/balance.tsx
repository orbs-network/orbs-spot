import type { Currency } from "@/lib/types";
import { Skeleton } from "./skeleton";
import { useSpendableBalance } from "@/lib/hooks/use-spendable-balance";
import { toPresetAmount } from "@/lib/input-amount";

export const Balance = ({
    currency,
    onAmountChange,
  }: {
    currency?: Currency;
    onAmountChange?: (amount: string) => void;
  }) => {
    const { formatted, spendable, maxDisabled, maxHint, isLoading } = useSpendableBalance(currency);
    const label = `Balance: ${formatted}`;

    if (!onAmountChange) {
      return isLoading ? (
        <Skeleton className="h-4 w-[40px]" />
      ) : (
        <p className="max-w-full truncate text-right text-sm font-medium text-muted-foreground">
          {label}
        </p>
      );
    }

    return (
      <button
        type="button"
        data-balance-action
        aria-label={`Use available ${currency?.symbol ?? "token"} balance`}
        disabled={maxDisabled}
        title={maxHint}
        className="flex min-w-0 cursor-pointer items-center justify-end gap-2 rounded-md text-right focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 disabled:cursor-wait"
        onClick={() => onAmountChange(toPresetAmount(spendable, currency?.decimals))}
      >
        {isLoading ? (
          <Skeleton className="h-4 w-[40px]" />
        ) : (
          <p className="max-w-full truncate text-right text-sm font-medium text-muted-foreground">
            {label}
          </p>
        )}
      </button>
    );
  };

