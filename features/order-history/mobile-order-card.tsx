"use client";

import { memo } from "react";

import { type Order, toAmountUI } from "@orbs-network/spot-ui";
import { ArrowRightIcon, ChevronRightIcon } from "lucide-react";
import { NetworkLabel } from "@/components/network-label";
import { useOrderCurrency } from "./use-order-currency";
import { OrderStatusLabel } from "./order-status-label";
import { formatDisplayNumber, formatOrderDate, getOrderTypeLabel, normalizeTimestamp } from "./format";
import { MarketTokenLink } from "./market-token-link";

function OrderDate({ label, value }: { label: string; value?: number }) {
  const timestamp = normalizeTimestamp(value);
  return (
    <div className="min-w-0 space-y-1">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="text-xs leading-relaxed">
        <time dateTime={timestamp ? new Date(timestamp).toISOString() : undefined}>{formatOrderDate(value) || "—"}</time>
      </dd>
    </div>
  );
}

export const MobileOrderCard = memo(function MobileOrderCard({ order, onSelect }: { order: Order; onSelect: (id: string, chainId: number) => void }) {
  const { currency: inputToken, isLoading: inputLoading } = useOrderCurrency(order.srcTokenAddress, order.chainId);
  const { currency: outputToken, isLoading: outputLoading } = useOrderCurrency(order.dstTokenAddress, order.chainId);
  const amount = inputToken ? toAmountUI(order.srcAmount, inputToken.decimals) : undefined;
  const type = getOrderTypeLabel(order.type);

  return (
    <article data-mobile-order-card aria-label={`${type} order ${order.id}`} className="min-w-0 border border-border bg-card text-left">
      <div className="space-y-3 px-4 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">{type}</p>
          <span data-order-status={order.status}><OrderStatusLabel order={order} /></span>
        </div>
        <div className="space-y-2">
          <div data-order-market className="flex min-w-0 flex-wrap items-center gap-2 [&_a]:min-h-9 [&_a]:content-center [&_a]:text-base [&_a]:[overflow-wrap:anywhere]">
            <MarketTokenLink address={order.srcTokenAddress} chainId={order.chainId} symbol={inputToken?.symbol} isLoading={inputLoading} />
            <ArrowRightIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
            <MarketTokenLink address={order.dstTokenAddress} chainId={order.chainId} symbol={outputToken?.symbol} isLoading={outputLoading} />
          </div>
        </div>
        <dl className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-3">
          <div className="min-w-0 space-y-1">
            <dt className="text-[11px] text-muted-foreground">Sell amount</dt>
            <dd title={amount} className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1 font-medium tabular-nums">
              <span className="text-lg [overflow-wrap:anywhere]">{amount ? formatDisplayNumber(amount) : "—"}</span>
              <span className="text-xs text-muted-foreground [overflow-wrap:anywhere]">{inputToken?.symbol}</span>
            </dd>
          </div>
          <div className="space-y-1">
            <dt className="text-[11px] text-muted-foreground">Filled</dt>
            <dd className="text-base font-medium tabular-nums">{Math.max(0, Math.min(100, Math.round(order.progress ?? 0)))}%</dd>
          </div>
        </dl>
        <dl className="grid grid-cols-2 gap-3">
          <OrderDate label="Created" value={order.createdAt} />
          <OrderDate label="Deadline" value={order.deadline} />
        </dl>
      </div>
      <div className="mt-3 flex min-w-0 items-center justify-between gap-3 border-t border-border px-4 py-1">
        <div className="min-w-0 text-xs text-muted-foreground"><NetworkLabel chainId={order.chainId} /></div>
        <button
          type="button"
          onClick={() => onSelect(order.historyKey, order.chainId)}
          aria-label={`View ${type} order ${order.id}`}
          className="flex min-h-11 shrink-0 items-center gap-2 px-2 text-left text-xs font-medium hover:bg-secondary focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
        >
          Details<ChevronRightIcon aria-hidden="true" className="size-4" />
        </button>
      </div>
    </article>
  );
});
