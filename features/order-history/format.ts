import { formatDecimals } from "@/lib/utils";
import { OrderFilter, OrderStatus, OrderType, TimeUnit, type Order } from "@orbs-network/spot-ui";

import { formatDateTime } from "@/lib/date";
import BN from "bignumber.js";

import type { useHistoryOrder } from "@/components/advanced-order/use-order-client";

export const ORDER_HISTORY_CLOSE_RESET_DELAY = 180;

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

export function getNoOrdersTitle(filter: OrderFilter) {
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
  if (!ms) return "-";
  const minutes = Math.round(ms / TimeUnit.Minutes);
  if (minutes < 60) return formatDurationUnit(minutes, "Minute");
  const hours = Math.round(ms / TimeUnit.Hours);
  if (hours < 48) return formatDurationUnit(hours, "Hour");
  const days = Math.round(ms / TimeUnit.Days);
  return formatDurationUnit(days, "Day");
}

export function filterAndSortOrders(orders: Order[], filter: OrderFilter) {
  const filtered =
    filter === OrderFilter.All
      ? orders
      : orders.filter(
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
  return formatDecimals(value?.toString() || "0", decimalScale) || "0";
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
  return `1 ${srcSymbol ?? ""} = ${formatDisplayNumber(price, 3)} ${
    dstSymbol ?? ""
  }`.trim();
}

export function isZeroValue(value?: string | number) {
  if (!value) return true;
  return BN(value).isZero();
}

