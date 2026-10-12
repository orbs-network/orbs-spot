"use client";

import { memo, useCallback, useState } from "react";

import { Button } from "@/components/ui/button";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { useOrderDisplay } from "./use-order-display";
import { OrderProgress } from "./order-progress";
import { CancelOrderDialog, OrderCancelButton } from "./cancel-order-dialog";
import { OrderStatusLabel } from "./order-status-label";

import { cn } from "@/lib/utils";
import { type Order } from "@orbs-network/spot-ui";
import { ArrowRightIcon, ChevronLeftIcon, ChevronRightIcon, ChevronsLeftIcon, ChevronsRightIcon } from "lucide-react";

import { getOrderTypeLabel, formatTokenValue } from "./format";

import { MarketTokenLink } from "./market-token-link";
import { NetworkLabel } from "@/components/network-label";
import { useIsMobile } from "@/lib/hooks/use-is-mobile";
import { MobileOrderList } from "./mobile-order-list";
import { OrderDetailsLink } from "./order-details-link";
const HISTORY_COLUMNS = ["Market", "Order type", "Sell amount", "Filled", "Status", "Actions"];

function HistoryTableHeader() {
  return (
    <TableHeader role="rowgroup" className="sticky top-0 z-10">
      <TableRow role="row">{HISTORY_COLUMNS.map((label) => <TableHead role="columnheader" key={label} scope="col">{label}</TableHead>)}</TableRow>
    </TableHeader>
  );
}

const OrderTableCells = memo(function OrderTableCells({ order, onSelect, onCancel }: {
  order: Order;
  onSelect: (id: string, chainId: number) => void;
  onCancel: (order: Order) => void;
}) {
  const { inputToken, outputToken, inputLoading, outputLoading, details } = useOrderDisplay(order);
  const amount = details?.inputAmount.ui;

  return (
    <>
      <TableCell role="cell" data-label="Market">
        <div className="flex flex-wrap items-center gap-2">
          <MarketTokenLink address={order.srcTokenAddress} chainId={order.chainId} symbol={inputToken?.symbol} isLoading={inputLoading} />
          <ArrowRightIcon aria-hidden="true" className="size-3 shrink-0 text-muted-foreground" />
          <MarketTokenLink address={order.dstTokenAddress} chainId={order.chainId} symbol={outputToken?.symbol} isLoading={outputLoading} />
        </div>
        <div data-history-market-network className="mt-2 text-xs text-muted-foreground"><NetworkLabel chainId={order.chainId} /></div>
      </TableCell>
      <TableCell role="cell" data-label="Order type">{getOrderTypeLabel(order.type)}</TableCell>
      <TableCell role="cell" data-label="Sell amount" title={amount ? `${amount} ${inputToken?.symbol ?? ""}`.trim() : undefined}>
        {formatTokenValue(amount, inputToken?.symbol)}
      </TableCell>
      <TableCell role="cell" data-label="Filled"><OrderProgress order={order} /></TableCell>
      <TableCell role="cell" data-label="Status"><span data-order-status={order.status}><OrderStatusLabel order={order} /></span></TableCell>
      <TableCell role="cell" data-label="Actions">
        <div className="flex flex-wrap items-center gap-2">
        <OrderDetailsLink
          order={order}
          onSelect={onSelect}
          className="inline-flex min-h-11 items-center justify-center gap-1.5 px-3 text-xs font-medium hover:bg-secondary focus-visible:outline-2 focus-visible:outline-primary"
          aria-label={`View ${getOrderTypeLabel(order.type)} order ${order.id}, ${inputToken?.symbol ?? "input token"} to ${outputToken?.symbol ?? "output token"}`}
        >
          Details<ArrowRightIcon aria-hidden="true" className="size-3.5 shrink-0" />
        </OrderDetailsLink>
        <OrderCancelButton order={order} onCancel={onCancel} />
        </div>
      </TableCell>
    </>
  );
});

export function OrderHistoryTable({ orders, onSelect, children, pageIndex, pageSize, onPageChange, onPageSizeChange, filterScope }: {
  orders: Order[];
  onSelect: (id: string, chainId: number) => void;
  children?: React.ReactNode;
  pageIndex: number;
  pageSize: number;
  onPageChange: (index: number) => void;
  onPageSizeChange: (size: number) => void;
  filterScope: string;
}) {
  const isMobile = useIsMobile("(max-width: 767px)");
  const [cancelKey, setCancelKey] = useState<string>();
  const onCancel = useCallback((order: Order) => setCancelKey(order.historyKey), []);
  const cancelOrder = orders.find(order => order.historyKey === cancelKey);
  const confirmation = cancelOrder && <CancelOrderDialog key={cancelOrder.historyKey} order={cancelOrder} onClose={() => setCancelKey(undefined)} />;
  const pageCount = Math.max(1, Math.ceil(orders.length / pageSize));
  const start = pageIndex * pageSize;
  const pageOrders = orders.slice(start, start + pageSize);

  if (isMobile) {
    return <><MobileOrderList key={filterScope} orders={orders} onSelect={onSelect} onCancel={onCancel}>{children}</MobileOrderList>{confirmation}</>;
  }

  return (
    <>
      <div data-history-table-region data-history-layout="table">
        <Table
          key={`${pageIndex}-${pageSize}`}
          data-history-table
          role="table"
          className="text-left"
          aria-label="Order history"
          containerProps={{
            role: "region",
            "aria-label": "Order history rows",
            tabIndex: 0,
            className: cn("min-h-0 overflow-auto focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary", orders.length ? "flex-1" : "shrink-0"),
          }}
        >
          <HistoryTableHeader />
          <TableBody role="rowgroup">
            {pageOrders.map((order) => (
              <TableRow role="row" key={order.historyKey}>
                <OrderTableCells order={order} onSelect={onSelect} onCancel={onCancel} />
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!orders.length && <div data-history-empty className="flex min-h-0 flex-1 flex-col overflow-auto">{children}</div>}
      </div>
      {orders.length > 0 && <div data-history-pagination className="flex shrink-0 flex-wrap items-center justify-between gap-3 text-xs">
        <p role="status" aria-atomic="true" className="text-muted-foreground">
          {orders.length ? `${start + 1}–${Math.min(start + pageSize, orders.length)} of ${orders.length} orders` : "0 orders"}
        </p>
        <div className="flex items-center gap-2">
          <label htmlFor="history-page-size" className="text-muted-foreground">Per page</label>
          <select
            id="history-page-size"
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            className="h-9 border border-border bg-background px-2 text-foreground focus-visible:outline-2 focus-visible:outline-primary"
          >
            {[10, 25, 50].map((size) => <option key={size} value={size}>{size}</option>)}
          </select>
        </div>
        <nav aria-label="Order history pagination" className="flex items-center gap-2 max-sm:w-full">
          <span className="mr-2 whitespace-nowrap tabular-nums max-sm:mr-auto">Page {pageIndex + 1} of {pageCount}</span>
          <Button variant="outline" size="icon" className="hidden sm:inline-flex" aria-label="First page" disabled={pageIndex === 0} onClick={() => onPageChange(0)}><ChevronsLeftIcon aria-hidden="true" /></Button>
          <Button variant="outline" size="icon" aria-label="Previous page" disabled={pageIndex === 0} onClick={() => onPageChange(pageIndex - 1)}><ChevronLeftIcon aria-hidden="true" /></Button>
          <Button variant="outline" size="icon" aria-label="Next page" disabled={pageIndex >= pageCount - 1} onClick={() => onPageChange(pageIndex + 1)}><ChevronRightIcon aria-hidden="true" /></Button>
          <Button variant="outline" size="icon" className="hidden sm:inline-flex" aria-label="Last page" disabled={pageIndex >= pageCount - 1} onClick={() => onPageChange(pageCount - 1)}><ChevronsRightIcon aria-hidden="true" /></Button>
        </nav>
      </div>}
      {confirmation}
    </>
  );
}
