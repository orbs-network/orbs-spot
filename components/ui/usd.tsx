import { Skeleton } from "./skeleton";
import { formatDisplayAmount } from "@/lib/token-display";
import BN from "bignumber.js";

export const USD = ({
    value,
    amount,
    isLoading = false,
  }: {
    value?: string;
    amount: string;
    isLoading?: boolean;
  }) => {
    const formatted = formatDisplayAmount(value, { decimalScale: 2, prefix: "$" });
    const label = formatted || (!amount || BN(amount).isZero() ? "$0.00" : "—");

    return (
      <div className="flex min-w-0 items-center gap-2">
        {isLoading ? (
          <Skeleton role="status" aria-label="Loading USD value…" className="h-4 w-[40px]" />
        ) : (
          <p className="truncate text-sm text-muted-foreground">{label}</p>
        )}
      </div>
    );
  };

