import BN from "bignumber.js";
import { OrderStatus, type Order } from "@orbs-network/spot-ui";
import { getOrderTypeLabel, normalizeTimestamp, type DerivedHistoryOrder } from "./format";
import { getChainName } from "@/lib/utils";
import type { HistoryOrder } from "@/lib/spot/order-tokens";

export type SortColumn = "placed" | "market" | "type" | "price" | "sold" | "sell" | "filled" | "received" | "average" | "end" | "status";
export type ActivitySort = { column: SortColumn; direction: "asc" | "desc" };
export const pairKey = (order: Order) => `${order.srcTokenAddress.toLowerCase()}:${order.dstTokenAddress.toLowerCase()}`;
export function matchesOrderSearch(order: HistoryOrder, search: string) {
  const query = search.trim().toLowerCase();
  return !query || [order.inputToken?.symbol, order.outputToken?.symbol, order.srcTokenAddress, order.dstTokenAddress]
    .some(value => value?.toLowerCase().includes(query));
}
export const orderStatus = (order: Order) => order.status === OrderStatus.Open ? order.fills.length ? "Partially filled" : "Open" : order.status === OrderStatus.Completed ? "Filled" : order.status === OrderStatus.Cancelled ? "Cancelled" : "Expired";
export function closedAt(order: Order) {
  if (order.status === OrderStatus.Completed) return normalizeTimestamp(order.filledOrderTimestamp) ?? normalizeTimestamp(order.fills.at(-1)?.timestamp);
  if (order.status === OrderStatus.Expired) return normalizeTimestamp(order.deadline);
  // The SDK does not expose cancellation time. Never substitute the placed time.
  return undefined;
}
export function sortActivity<Row extends DerivedHistoryOrder>(rows: Row[], sort: ActivitySort, history: boolean) {
  const value = (row: DerivedHistoryOrder): string | number | undefined => {
    switch (sort.column) {
      case "placed": return normalizeTimestamp(row.createdAt);
      case "market": return `${row.inputToken?.symbol ?? row.original.srcTokenAddress}/${row.outputToken?.symbol ?? row.original.dstTokenAddress}`;
      case "type": return getOrderTypeLabel(row.orderType);
      case "price": return row.triggerPrice.ui && !BN(row.triggerPrice.ui).isZero() ? row.triggerPrice.ui : row.limitPrice.ui || undefined;
      case "sold": return row.inputAmountFilled.ui || undefined;
      case "sell": return row.inputAmount.ui || undefined;
      case "filled": return row.progress;
      case "received": return row.outputAmountFilled.ui || undefined;
      case "average": return row.original.fills.length ? row.executionPrice.ui || undefined : undefined;
      case "end": return history ? closedAt(row.original) : normalizeTimestamp(row.deadline);
      case "status": return orderStatus(row.original);
    }
  };
  return [...rows].sort((a, b) => {
    const av = value(a), bv = value(b);
    if (av === undefined) return bv === undefined ? a.original.historyKey.localeCompare(b.original.historyKey) : 1;
    if (bv === undefined) return -1;
    const textual = ["market", "type", "status"].includes(sort.column);
    const comparison = textual ? String(av).localeCompare(String(bv)) : BN(av).comparedTo(bv) ?? 0;
    return (sort.direction === "asc" ? comparison : -comparison) || a.original.historyKey.localeCompare(b.original.historyKey);
  });
}
export function activityCsv(rows: DerivedHistoryOrder[]) {
  const iso = (time?: number) => time ? new Date(time).toISOString() : "";
  const escape = (value: unknown) => {
    const text = String(value ?? "");
    // Prevent spreadsheet formulas in untrusted token symbols and IDs.
    return `"${(/^\s*[=+\-@]|^[\t\r]/.test(text) ? "'" : "") + text.replaceAll('"', '""')}"`;
  };
  const header = ["Order ID", "Network", "Chain ID", "Placed (UTC)", "Sell token", "Sell address", "Buy token", "Buy address", "Type", "Status", "Sell amount", "Filled trades", "Total trades", "Received", "Limit price", "Trigger price", "Average fill price", "Expires (UTC)", "Closed (UTC)"];
  return [header, ...rows.map(row => [row.id, getChainName(row.original.chainId), row.original.chainId, iso(normalizeTimestamp(row.createdAt)), row.inputToken?.symbol, row.original.srcTokenAddress, row.outputToken?.symbol, row.original.dstTokenAddress, getOrderTypeLabel(row.orderType), orderStatus(row.original), row.inputAmount.ui, row.fills.length, row.totalTrades, row.outputAmountFilled.ui, row.limitPrice.ui, row.triggerPrice.ui, row.fills.length ? row.executionPrice.ui : "", iso(normalizeTimestamp(row.deadline)), iso(closedAt(row.original))])].map(row => row.map(escape).join(",")).join("\r\n");
}
