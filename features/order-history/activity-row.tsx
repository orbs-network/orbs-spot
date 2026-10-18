"use client";

import { memo, useMemo, type ReactNode } from "react";
import { ArrowRightIcon } from "lucide-react";
import { OrderStatus, type Order } from "@orbs-network/spot-ui";
import { describeOrder } from "@/lib/spot/history";
import { OrderRateText } from "./order-rate";
import { NetworkLabel } from "@/components/network-label";
import { Skeleton } from "@/components/ui/skeleton";
import { TokenFlow } from "./token-flow";
import type { ActivityRow } from "./use-activity-rows";
import type { ActivityColumn } from "./activity-columns";
import { formatActivityNumber, getOrderTypeLabel } from "./format";
import { OrderStatusLabel } from "./order-status-label";
import { OrderProgress } from "./order-progress";
import { OrderCancelButton } from "./cancel-order-dialog";
import { ActivityTime } from "./activity-feed";
import styles from "./activity-list.module.css";

function value(amount: string, symbol?: string) { return amount ? `${formatActivityNumber(amount)} ${symbol ?? ""}` : "—"; }

export const OrderActivityRow = memo(function OrderActivityRow({ metadata, index, total, view, columns, partner, address, isPending, isRecent, onSelect, onCancel }: {
  metadata: ActivityRow; index: number; total: number; view: "open" | "history";
  columns: readonly ActivityColumn[]; partner: string;
  address?: string; isPending: boolean; isRecent: boolean;
  onSelect: (id: string, chainId: number) => void; onCancel: (order: Order) => void;
}) {
  const order = metadata.original;
  const row = useMemo(() => ({ ...metadata, ...describeOrder(order, metadata.inputToken, metadata.outputToken) }), [metadata, order]);
  const history = view === "history";
  const inputLoading = row.inputLoading && !row.inputToken;
  const outputLoading = row.outputLoading && !row.outputToken;
  const isEligible = order.status === OrderStatus.Open && order.maker.toLowerCase() === address?.toLowerCase() && !isPending;
  const open = () => { if (!isPending) onSelect(order.historyKey, order.chainId); };
  const renderField = (column: ActivityColumn) => {
      let content: ReactNode;
      const loading = column.key === "sell" ? inputLoading
        : column.key === "average" ? row.fills.length > 0 && (inputLoading || outputLoading)
        : column.key === "tokens" && (inputLoading || outputLoading);
      if (loading && column.key !== "tokens") {
        content = <><Skeleton className="h-4 w-24 max-w-full" aria-hidden="true" /><span className="sr-only">Loading</span></>;
      } else switch (column.key) {
        case "placed": content = <ActivityTime timestamp={order.createdAt} />; break;
        case "chain": content = <NetworkLabel chainId={order.chainId} />; break;
        case "partner": {
          const name = order.partner ?? partner;
          content = name.charAt(0).toUpperCase() + name.slice(1);
          break;
        }
        case "type": content = <button type="button" data-variant="link" className={styles.typeLink} title={`${getOrderTypeLabel(order.type)} · Order ${order.id}`} disabled={isPending} onClick={open} aria-label={`View order ${order.id}`}>{getOrderTypeLabel(order.type)}</button>; break;
        case "status": content = <>{isPending ? "Pending" : <OrderStatusLabel order={order} />}{isRecent && <small className="text-primary">Just placed</small>}</>; break;
        case "tokens": content = <TokenFlow input={{ symbol: order.inputToken?.symbol, address: order.srcTokenAddress, loading: inputLoading }} output={{ symbol: order.outputToken?.symbol, address: order.dstTokenAddress, loading: outputLoading }} />; break;
        case "sell": content = value(row.inputAmount.ui, row.inputToken?.symbol); break;
        case "filled": content = <OrderProgress order={order} />; break;
        case "average": content = row.fills.length ? <OrderRateText value={row.executionPrice.ui} inputSymbol={row.inputToken?.symbol} outputSymbol={row.outputToken?.symbol} /> : <span className="text-muted-foreground">No fills yet</span>; break;
      }
      const label = column.label;
      return <div className={column.key === "placed" ? `${styles.field} ${styles.frozenCell}` : styles.field} key={column.key} data-column={column.key} data-label={label} aria-busy={loading || undefined}>
        {column.key === "type" && !history && <div data-column="cancel">{isEligible && <OrderCancelButton order={order} onCancel={onCancel} />}</div>}
        <span className="sr-only">{label}: </span>{content}
      </div>;
  };
  return <article role="listitem" aria-posinset={index + 1} aria-setsize={total} className={styles.row} data-activity-row data-view={view} data-pending={isPending} data-recent={isRecent} onClick={event => { if (!(event.target as Element).closest("button, a, input, label")) open(); }}>
    {columns.map(renderField)}
    <div data-column="actions">{!isPending && <button data-icon-button type="button" className={styles.rowArrow} onClick={open} aria-label={`Open details for order ${order.id}`}><ArrowRightIcon aria-hidden="true" /></button>}</div>
  </article>;
});
