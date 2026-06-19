import { Currency } from "@/lib/types";
import { Skeleton } from "./skeleton";
import BN from "bignumber.js";
import { useBalance } from "@/lib/hooks/use-balances";
import { formatDecimals } from "@/lib/utils";

export const Balance = ({
    currency,
    onAmountChange,
  }: {
    currency?: Currency;
    onAmountChange: (amount: string) => void;
  }) => {
    const { formatted, ui, isLoading } = useBalance(currency);
    return (
      <div
        className="flex min-w-0 cursor-pointer items-center justify-end gap-2"
        onClick={() => onAmountChange?.(formatDecimals(BN(ui).toString(), 8))}
      >
        {isLoading ? (
          <Skeleton className="h-4 w-[40px]" />
        ) : (
          <p className="max-w-full truncate text-right text-sm font-medium text-muted-foreground">
            {formatted} {currency?.symbol}
          </p>
        )}
      </div>
    );
  };
  
