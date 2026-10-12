"use client";

import { memo } from "react";

import { type Order } from "@orbs-network/spot-ui";
import { ArrowRightIcon, EyeIcon } from "lucide-react";
import { NetworkLabel } from "@/components/network-label";
import { useOrderDisplay } from "./use-order-display";
import { OrderProgress } from "./order-progress";
import { OrderCancelButton } from "./cancel-order-dialog";
import { OrderStatusLabel } from "./order-status-label";
import { formatDisplayNumber, getOrderTypeLabel } from "./format";
import { MarketTokenLink } from "./market-token-link";
import { OrderDetailsLink } from "./order-details-link";

export const MobileOrderCard = memo(function MobileOrderCard({ order, onSelect, onCancel }: { order: Order; onSelect: (id: string, chainId: number) => void; onCancel: (order: Order) => void }) {
  const { inputToken, outputToken, inputLoading, outputLoading, details } = useOrderDisplay(order);
  const amount = details?.inputAmount.ui;
  const type = getOrderTypeLabel(order.type);

  return (
    <article data-mobile-order-card aria-label={`${type} order ${order.id}`} className="min-w-0 border border-border bg-card text-left">
      <div className="space-y-3 px-4 pt-4">
        <div className="flex flex-wrap items-center gap-2">
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
        <dl data-order-amounts className="grid grid-cols-2 gap-3">
          <div className="min-w-0 space-y-1">
            <dt className="text-[11px] text-muted-foreground">Sell amount</dt>
            <dd title={amount} className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1 font-medium tabular-nums">
              <span className="text-lg [overflow-wrap:anywhere]">{amount ? formatDisplayNumber(amount) : "—"}</span>
              <span className="text-xs text-muted-foreground [overflow-wrap:anywhere]">{inputToken?.symbol}</span>
            </dd>
          </div>
          <div className="space-y-1">
            <dt className="text-[11px] text-muted-foreground">Filled</dt>
            <dd><OrderProgress order={order} /></dd>
          </div>
        </dl>
      </div>
      <div data-order-card-footer className="mt-3 flex min-w-0 flex-wrap items-center gap-3 border-t border-border px-4 py-1">
        <div className="min-w-0 text-xs text-muted-foreground"><NetworkLabel chainId={order.chainId} /></div>
        <div className="flex items-center gap-1">
        <OrderCancelButton order={order} onCancel={onCancel} />
        <OrderDetailsLink
          order={order}
          onSelect={onSelect}
          aria-label={`View ${type} order ${order.id}`}
          className="flex min-h-11 shrink-0 items-center gap-2 px-2 text-left text-xs font-medium hover:bg-secondary focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
        >
          <EyeIcon aria-hidden="true" className="size-3.5 shrink-0" />Details
        </OrderDetailsLink>
        </div>
      </div>
    </article>
  );
});
