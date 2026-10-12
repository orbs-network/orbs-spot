"use client";

import { useOrderCurrency } from "./use-order-currency";
import type { HistoryOrder, OrderToken as OrderTokenMetadata } from "@/lib/spot/order-tokens";
import { OrderStatusLabel } from "./order-status-label";
import { TokenSymbol } from "./token-symbol";

import { cn } from "@/lib/utils";
import { OrderStatus } from "@orbs-network/spot-ui";
import { ArrowRightIcon } from "lucide-react";

import { STATUS_CLASS_NAMES, getOrderTypeLabel, formatOrderDate } from "./format";

export function OrderToken({ address, chainId, token }: { address?: string; chainId?: number; token?: OrderTokenMetadata }) {
  const { currency, isLoading } = useOrderCurrency(address, chainId, token);

  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <p className="truncate text-[13px] font-semibold text-foreground">
        <TokenSymbol symbol={currency?.symbol} isLoading={isLoading} />
      </p>
    </div>
  );
}

export function OrderProgress({
  status,
  value,
}: {
  status: OrderStatus;
  value?: number;
}) {
  const progress = Math.max(0, Math.min(100, Math.round(value ?? 0)));
  const isComplete = status === OrderStatus.Completed;

  return (
    <div data-order-progress className="flex items-center gap-3">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border">
        <div
          className={cn(
            "h-full rounded-full transition-[width]",
            isComplete ? "bg-primary" : "bg-border",
          )}
          style={{ width: `${progress}%` }}
        />
      </div>
      <span className="w-10 text-right text-sm font-medium text-muted-foreground">
        {progress}%
      </span>
    </div>
  );
}

export function OrderListItem({
  onSelect,
  order,
}: {
  onSelect: (orderId: string, chainId: number) => void;
  order: HistoryOrder;
}) {
  const orderTitle = getOrderTypeLabel(order.type);
  const orderDate = formatOrderDate(order.createdAt);

  return (
    <button
      type="button"
      data-order-row
      onClick={() => onSelect(order.historyKey, order.chainId)}
      className="mb-1.5 flex w-full cursor-pointer flex-col gap-2 rounded-[13px] border border-border/50 bg-secondary/30 px-3 py-2 text-left transition-colors hover:bg-primary/6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 truncate text-[13px] font-medium text-foreground">
          {orderTitle}
          {orderDate && <span className="font-normal"> ({orderDate})</span>}
        </p>
        <span
          data-order-status={order.status}
          className={cn(
            "shrink-0 text-[10px] font-semibold uppercase leading-none",
            STATUS_CLASS_NAMES[order.status],
          )}
        >
          <OrderStatusLabel order={order} />
        </span>
      </div>
      <OrderProgress status={order.status} value={order.progress} />
      <div className="flex min-w-0 items-center gap-2">
        <OrderToken address={order.srcTokenAddress} chainId={order.chainId} token={order.inputToken} />
        <ArrowRightIcon aria-hidden="true" className="size-4 shrink-0 text-foreground" />
        <OrderToken address={order.dstTokenAddress} chainId={order.chainId} token={order.outputToken} />
      </div>
    </button>
  );
}
