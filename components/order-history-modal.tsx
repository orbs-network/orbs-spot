"use client";

import { CurrencyLogo } from "@/components/ui/currency-logo";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { useCurrency } from "@/lib/hooks/use-currencies";
import { useFormatNumber, useToAmountUI } from "@/lib/hooks/common";
import { cn, getExplorerUrl, makeEllipsisAddress } from "@/lib/utils";
import {
  OrderFilter,
  OrderStatus,
  OrderType,
  useSpot,
  type Order,
} from "@orbs-network/spot-react";
import {
  ArrowRightIcon,
  ExternalLinkIcon,
  RefreshCwIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Virtuoso } from "react-virtuoso";
import { useConnection } from "wagmi";
import { useOrderHistoryModal } from "./order-history-context";

const ORDER_FILTER_OPTIONS = [
  OrderFilter.All,
  OrderFilter.Open,
  OrderFilter.Completed,
  OrderFilter.Cancelled,
  OrderFilter.Expired,
] as const;

const STATUS_CLASS_NAMES: Record<OrderStatus, string> = {
  [OrderStatus.Open]: "border-primary/35 bg-primary/12 text-primary",
  [OrderStatus.Completed]: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  [OrderStatus.Cancelled]: "border-muted-foreground/25 bg-muted/40 text-muted-foreground",
  [OrderStatus.Expired]: "border-destructive/35 bg-destructive/10 text-destructive",
};

const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  [OrderType.LIMIT]: "Limit",
  [OrderType.TWAP_LIMIT]: "TWAP Limit",
  [OrderType.TWAP_MARKET]: "TWAP",
  [OrderType.TAKE_PROFIT_LIMIT]: "Take Profit",
  [OrderType.TAKE_PROFIT_MARKET]: "Take Profit",
  [OrderType.STOP_LOSS_LIMIT]: "Stop Loss",
  [OrderType.STOP_LOSS_MARKET]: "Stop Loss",
};

function getOrderFilterLabel(filter: OrderFilter) {
  switch (filter) {
    case OrderFilter.All:
      return "All";
    case OrderFilter.Open:
      return "Open";
    case OrderFilter.Completed:
      return "Completed";
    case OrderFilter.Cancelled:
      return "Cancelled";
    case OrderFilter.Expired:
      return "Expired";
    default:
      return filter;
  }
}

function getOrderTypeLabel(orderType?: OrderType) {
  if (!orderType) return "Order";
  return ORDER_TYPE_LABELS[orderType] ?? "Order";
}

function normalizeTimestamp(timestamp?: number) {
  if (!timestamp) return undefined;
  return timestamp < 1_000_000_000_000 ? timestamp * 1000 : timestamp;
}

function formatOrderDate(timestamp?: number) {
  const normalizedTimestamp = normalizeTimestamp(timestamp);
  if (!normalizedTimestamp) return "";

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(normalizedTimestamp));
}

function filterAndSortOrders(orders: Order[], filter: OrderFilter) {
  const filtered =
    filter === OrderFilter.All
      ? orders
      : orders.filter(
          (order) => order.status === (filter as unknown as OrderStatus),
        );

  return [...filtered].sort((a, b) => b.createdAt - a.createdAt);
}

function OrderToken({
  address,
  amount,
}: {
  address?: string;
  amount?: string;
}) {
  const currency = useCurrency(address);
  const amountUI = useToAmountUI(currency?.decimals, amount);
  const formattedAmount = useFormatNumber({ value: amountUI, decimalScale: 4 });

  return (
    <div className="flex min-w-0 items-center gap-2">
      <CurrencyLogo currency={currency} className="size-8" />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-foreground">
          {currency?.symbol ?? makeEllipsisAddress(address)}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {formattedAmount || "0"}
        </p>
      </div>
    </div>
  );
}

function OrderProgress({ value }: { value?: number }) {
  const progress = Math.max(0, Math.min(100, Math.round(value ?? 0)));

  return (
    <div className="flex items-center gap-3">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-primary transition-[width]"
          style={{ width: `${progress}%` }}
        />
      </div>
      <span className="w-10 text-right text-xs font-medium text-muted-foreground">
        {progress}%
      </span>
    </div>
  );
}

function OrderListItem({ order }: { order: Order }) {
  const explorerUrl = getExplorerUrl(order.chainId, order.txHash);

  return (
    <div className="mb-2 rounded-[18px] border border-border/70 bg-secondary/30 p-3 transition-colors hover:border-primary/35 hover:bg-secondary/45">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">
            {getOrderTypeLabel(order.type)}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {formatOrderDate(order.createdAt)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className={cn(
              "rounded-full border px-2.5 py-1 text-[11px] font-semibold",
              STATUS_CLASS_NAMES[order.status],
            )}
          >
            {getOrderFilterLabel(order.status as unknown as OrderFilter)}
          </span>
          {explorerUrl && (
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="View order transaction"
              className="flex size-8 items-center justify-center rounded-full border border-border/70 text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/10 hover:text-primary"
            >
              <ExternalLinkIcon className="size-4" />
            </a>
          )}
        </div>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
        <OrderToken address={order.srcTokenAddress} amount={order.srcAmount} />
        <ArrowRightIcon className="size-4 text-muted-foreground" />
        <OrderToken
          address={order.dstTokenAddress}
          amount={order.dstMinAmountTotal}
        />
      </div>
      <div className="mt-3">
        <OrderProgress value={order.progress} />
      </div>
    </div>
  );
}

function OrderHistoryEmpty({
  hasWallet,
  selectedFilter,
}: {
  hasWallet: boolean;
  selectedFilter: OrderFilter;
}) {
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center rounded-[22px] border border-dashed border-border/80 bg-secondary/20 px-6 text-center">
      <p className="text-base font-semibold text-foreground">
        {hasWallet
          ? `No ${getOrderFilterLabel(selectedFilter).toLowerCase()} orders`
          : "Connect wallet to view orders"}
      </p>
      <p className="mt-2 max-w-[320px] text-sm text-muted-foreground">
        {hasWallet
          ? "Your order history will appear here after you create an order."
          : "Order history is loaded from the connected wallet on the selected network."}
      </p>
    </div>
  );
}

export function OrderHistoryModal() {
  const { address } = useConnection();
  const { open, setOpen } = useOrderHistoryModal();
  const {
    orders,
    isLoading,
    isRefetching,
    refetchOrders,
  } = useSpot().orderHistoryPanel;
  const [selectedFilter, setSelectedFilter] = useState<OrderFilter>(
    OrderFilter.All,
  );

  const filteredOrders = useMemo(
    () => filterAndSortOrders(orders.all, selectedFilter),
    [orders.all, selectedFilter],
  );

  const title = `Orders (${orders.all.length})`;
  const loading = isLoading || isRefetching;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        presentation="center"
        className="w-[calc(100vw-1rem)] max-w-[560px] gap-0 overflow-hidden rounded-[28px] border-border/80 bg-card/98 p-0"
      >
        <DialogHeader className="border-b border-border/70 px-5 py-5 text-left">
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="text-[24px] font-semibold leading-none">
              {title}
            </DialogTitle>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Refresh order history"
              isLoading={loading}
              onClick={() => void refetchOrders()}
              className="size-10 rounded-full"
            >
              <RefreshCwIcon className="size-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-4 p-4 sm:p-5">
          <Select
            value={selectedFilter}
            onValueChange={(value) => setSelectedFilter(value as OrderFilter)}
          >
            <SelectTrigger className="h-11 w-full rounded-[16px] border-border/70 bg-transparent text-sm font-semibold text-foreground shadow-none sm:w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-[18px] border-border/80 bg-popover p-1 shadow-[0_18px_70px_rgba(0,0,0,0.45)]">
              {ORDER_FILTER_OPTIONS.map((filter) => (
                <SelectItem
                  key={filter}
                  value={filter}
                  className="h-10 rounded-[14px] text-muted-foreground hover:bg-secondary hover:text-foreground focus:bg-secondary focus:text-foreground data-[state=checked]:bg-primary/14 data-[state=checked]:text-foreground"
                >
                  {getOrderFilterLabel(filter)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {loading && !filteredOrders.length ? (
            <div className="flex min-h-[220px] items-center justify-center">
              <Spinner className="size-10" />
            </div>
          ) : filteredOrders.length ? (
            <div className="h-[420px] overflow-hidden">
              <Virtuoso
                style={{ height: "100%" }}
                data={filteredOrders}
                itemContent={(_, order) => <OrderListItem order={order} />}
              />
            </div>
          ) : (
            <OrderHistoryEmpty
              hasWallet={Boolean(address)}
              selectedFilter={selectedFilter}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
