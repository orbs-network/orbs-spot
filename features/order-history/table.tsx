"use client";

import { memo } from "react";

import { Button } from "@/components/ui/button";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { useOrderCurrency } from "./use-order-currency";
import { OrderStatusLabel } from "./order-status-label";

import { cn } from "@/lib/utils";
import { type Order, toAmountUI } from "@orbs-network/spot-ui";
import { ArrowRightIcon, ChevronLeftIcon, ChevronRightIcon, ChevronsLeftIcon, ChevronsRightIcon } from "lucide-react";

import { getOrderTypeLabel, normalizeTimestamp, formatOrderDate, formatTokenValue } from "./format";

import { MarketTokenLink } from "./market-token-link";
import { NetworkLabel } from "@/components/network-label";
import { useIsMobile } from "@/lib/hooks/use-is-mobile";
import { MobileOrderList } from "./mobile-order-list";
const HISTORY_COLUMNS = ["Chain", "Order type", "Market", "Sell amount", "Filled", "Status", "Timing", "Details"];

function HistoryTableHeader() {
  return (
    <TableHeader role="rowgroup" className="sticky top-0 z-10">
      <TableRow role="row">{HISTORY_COLUMNS.map((label) => <TableHead role="columnheader" key={label} scope="col">{label}</TableHead>)}</TableRow>
    </TableHeader>
  );
}

const OrderTableCells = memo(function OrderTableCells({ order, onSelect }: {
  order: Order;
  onSelect: (id: string, chainId: number) => void;
}) {
  const { currency: inputToken, isLoading: inputLoading } = useOrderCurrency(order.srcTokenAddress, order.chainId);
  const { currency: outputToken, isLoading: outputLoading } = useOrderCurrency(order.dstTokenAddress, order.chainId);
  const amount = inputToken ? toAmountUI(order.srcAmount, inputToken.decimals) : undefined;
  const timestamp = normalizeTimestamp(order.createdAt);
  const deadline = normalizeTimestamp(order.deadline);

  return (
    <>
      <TableCell role="cell" data-label="Chain"><NetworkLabel chainId={order.chainId} /></TableCell>
      <TableCell role="cell" data-label="Order type">{getOrderTypeLabel(order.type)}</TableCell>
      <TableCell role="cell" data-label="Market">
        <div className="flex flex-wrap items-center gap-2">
          <MarketTokenLink address={order.srcTokenAddress} chainId={order.chainId} symbol={inputToken?.symbol} isLoading={inputLoading} />
          <ArrowRightIcon aria-hidden="true" className="size-3 shrink-0 text-muted-foreground" />
          <MarketTokenLink address={order.dstTokenAddress} chainId={order.chainId} symbol={outputToken?.symbol} isLoading={outputLoading} />
        </div>
      </TableCell>
      <TableCell role="cell" data-label="Sell amount" title={amount ? `${amount} ${inputToken?.symbol ?? ""}`.trim() : undefined}>
        {formatTokenValue(amount, inputToken?.symbol)}
      </TableCell>
      <TableCell role="cell" data-label="Filled" className="tabular-nums">{Math.max(0, Math.min(100, Math.round(order.progress ?? 0)))}%</TableCell>
      <TableCell role="cell" data-label="Status"><span data-order-status={order.status}><OrderStatusLabel order={order} /></span></TableCell>
      <TableCell role="cell" data-label="Timing">
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-1 text-xs">
          <dt className="text-muted-foreground">Created</dt>
          <dd>
            <time dateTime={timestamp ? new Date(timestamp).toISOString() : undefined}>
              {formatOrderDate(order.createdAt) || "—"}
            </time>
          </dd>
          <dt className="text-muted-foreground">Deadline</dt>
          <dd>
            <time dateTime={deadline ? new Date(deadline).toISOString() : undefined}>
              {formatOrderDate(order.deadline) || "—"}
            </time>
          </dd>
        </dl>
      </TableCell>
      <TableCell role="cell" data-label="Details">
        <button
          type="button"
          onClick={() => onSelect(order.historyKey, order.chainId)}
          className="inline-flex min-h-9 items-center gap-1 px-2 text-xs font-medium hover:bg-secondary focus-visible:outline-2 focus-visible:outline-primary"
          aria-label={`View ${getOrderTypeLabel(order.type)} order ${order.id}, ${inputToken?.symbol ?? "input token"} to ${outputToken?.symbol ?? "output token"}`}
        >
          View<ChevronRightIcon aria-hidden="true" className="size-3" />
        </button>
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
  const pageCount = Math.max(1, Math.ceil(orders.length / pageSize));
  const start = pageIndex * pageSize;
  const pageOrders = orders.slice(start, start + pageSize);

  if (isMobile) {
    return <MobileOrderList key={filterScope} orders={orders} onSelect={onSelect}>{children}</MobileOrderList>;
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
            className: cn("min-h-0 overflow-x-hidden focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary", orders.length ? "flex-1 overflow-y-auto" : "shrink-0"),
          }}
        >
          <HistoryTableHeader />
          <TableBody role="rowgroup">
            {pageOrders.map((order) => (
              <TableRow role="row" key={order.historyKey}>
                <OrderTableCells order={order} onSelect={onSelect} />
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!orders.length && <div data-history-empty className="flex min-h-0 flex-1 flex-col overflow-auto">{children}</div>}
      </div>
      <div data-history-pagination className="flex shrink-0 flex-wrap items-center justify-between gap-3 text-xs">
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
      </div>
    </>
  );
}
