import type { Order } from "@orbs-network/spot-ui";
import type { ReactNode } from "react";

export function OrderProgress({ order, label }: { order: Order; label?: ReactNode }) {
  const progress = Number.isFinite(order.progress) ? Math.max(0, Math.min(100, order.progress)) : 0;
  const total = Math.max(1, order.totalTradesAmount);
  const filled = order.fills.length;
  return (
    <span data-history-fill-progress className="flex min-w-0 flex-col gap-1.5 tabular-nums">
      <span className="text-xs">{label ?? <>{Math.round(progress)}% <span className="text-muted-foreground">({filled}/{total})</span></>}</span>
      <span role="progressbar" aria-label="Order filled" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-valuetext={`${filled} of ${total} trades filled, ${Math.round(progress)} percent`} className="block h-1.5 w-full overflow-hidden rounded-full bg-border">
        <span className="block h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
      </span>
    </span>
  );
}
