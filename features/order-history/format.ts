import { formatDisplayAmount } from "@/lib/token-display";
import { OrderFilter, OrderStatus, OrderType, TimeUnit, type Order } from "@orbs-network/spot-ui";

import { formatDateTime } from "@/lib/date";
import BN from "bignumber.js";

import type { useHistoryOrder } from "@/components/advanced-order/use-order-client";

export const ORDER_HISTORY_CLOSE_RESET_DELAY = 180;

/** Order display values only; calculations retain full precision. */
export function formatActivityNumber(value: string) {
  const number = BN(value);
  if (!number.isFinite()) return "—";
  return formatDisplayAmount(value);
}

export type HistoryFilter = OrderFilter | "history";

export function getPageHistoryFilter(value: string | null): OrderFilter.Open | "history" {
  return ["history", "swaps", "all", "completed", "cancelled", "expired"].includes(value?.toLowerCase() ?? "") ? "history" : OrderFilter.Open;
}

export const ORDER_FILTER_OPTIONS = [
  OrderFilter.All,
  OrderFilter.Open,
  OrderFilter.Completed,
  OrderFilter.Cancelled,
  OrderFilter.Expired,
] as const;

export type DerivedHistoryOrder = NonNullable<
  ReturnType<typeof useHistoryOrder>
>;
export type DerivedHistoryFill = DerivedHistoryOrder["fills"][number];
export type OpenDetailSection = "summary" | "info" | undefined;

export const STATUS_CLASS_NAMES: Record<OrderStatus, string> = {
  [OrderStatus.Open]: "text-primary",
  [OrderStatus.Completed]: "text-emerald-400",
  [OrderStatus.Cancelled]: "text-red-400",
  [OrderStatus.Expired]: "text-red-400",
};

export const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  [OrderType.LIMIT]: "Limit",
  [OrderType.TWAP_LIMIT]: "TWAP Limit",
  [OrderType.TWAP_MARKET]: "TWAP Market",
  [OrderType.TAKE_PROFIT_LIMIT]: "Take Profit Limit",
  [OrderType.TAKE_PROFIT_MARKET]: "Take Profit Market",
  [OrderType.STOP_LOSS_LIMIT]: "Stop Loss Limit",
  [OrderType.STOP_LOSS_MARKET]: "Stop Loss Market",
};

export function getOrderFilterLabel(filter: OrderFilter) {
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

export function getNoOrdersTitle(filter: HistoryFilter) {
  if (filter === "history") return "No past orders";
  if (filter === OrderFilter.All) {
    return "No orders";
  }

  return `No ${getOrderFilterLabel(filter).toLowerCase()} orders`;
}

export function getOrderTypeLabel(orderType?: OrderType) {
  if (!orderType) return "Order";
  return ORDER_TYPE_LABELS[orderType] ?? "Order";
}

export function normalizeTimestamp(timestamp?: number) {
  if (!timestamp) return undefined;
  return timestamp < 1_000_000_000_000 ? timestamp * 1000 : timestamp;
}

export function formatOrderDate(timestamp?: number) {
  const normalizedTimestamp = normalizeTimestamp(timestamp);
  if (!normalizedTimestamp) return "";

  return formatDateTime(normalizedTimestamp);
}

export function formatDetailDate(timestamp?: number) {
  const normalizedTimestamp = normalizeTimestamp(timestamp);
  if (!normalizedTimestamp) return "-";

  return formatDateTime(normalizedTimestamp);
}

export function formatDurationUnit(value: number, unit: string) {
  return `${value} ${unit}${value === 1 ? "" : "s"}`;
}

export function formatDuration(ms?: number) {
  if (!ms || !Number.isFinite(ms) || ms < 0) return "-";
  if (ms < 1000) return "<1 Second";
  if (ms < TimeUnit.Minutes) return formatDurationUnit(Math.round(ms / 1000), "Second");
  const minutes = Math.round(ms / TimeUnit.Minutes);
  if (minutes < 60) return formatDurationUnit(minutes, "Minute");
  const hours = Math.round(ms / TimeUnit.Hours);
  if (hours < 48) return formatDurationUnit(hours, "Hour");
  const days = Math.round(ms / TimeUnit.Days);
  return formatDurationUnit(days, "Day");
}

export function filterAndSortOrders(orders: Order[], filter: HistoryFilter) {
  const filtered =
    filter === OrderFilter.All
      ? orders
      : filter === "history" ? orders.filter(order => order.status !== OrderStatus.Open) : orders.filter(
          (order) => order.status === (filter as unknown as OrderStatus),
        );

  return [...filtered].sort((a, b) => b.createdAt - a.createdAt);
}

export function getOrderStatusLabel(status: OrderStatus) {
  return getOrderFilterLabel(status as unknown as OrderFilter).toUpperCase();
}

export function getOrderStatusTitle(status: OrderStatus) {
  return getOrderFilterLabel(status as unknown as OrderFilter);
}

export function formatDisplayNumber(value?: string | number, decimalScale = 4) {
  return formatDisplayAmount(value ?? "0", { decimalScale }) || "0";
}

export function formatTokenValue(
  amount?: string,
  symbol?: string,
  decimalScale = 4,
) {
  // Missing decimals produce an empty UI amount; distinguish unknown from a real zero.
  if (!amount) return "-";
  return `${formatDisplayNumber(amount, decimalScale)} ${symbol ?? ""}`.trim();
}

export function formatPriceValue(
  price?: string,
  srcSymbol?: string,
  dstSymbol?: string,
) {
  if (!price) return "-";
  const value = BN(price);
  if (!value.isFinite()) return "-";
  return `1 ${srcSymbol ?? ""} = ${formatActivityNumber(price)} ${
    dstSymbol ?? ""
  }`.trim();
}

export function isZeroValue(value?: string | number) {
  if (!value) return true;
  return BN(value).isZero();
}

/** Do not show numeric amounts before the token's decimals are known. */
export function formatOrderAmount(value?: string, token?: { symbol: string; decimals: number }) {
  return value && token ? formatActivityNumber(value) : "—";
}
