"use client";

import { useCallback, useState, type ReactNode } from "react";
import { useConnection } from "wagmi";
import type { Order } from "@orbs-network/spot-ui";
import { useOrderActivity } from "./use-order-activity";
import type { ActivityRow } from "./use-activity-rows";
import { getActivityColumns } from "./activity-columns";
import { OrderActivityRow } from "./activity-row";
import { CancelOrderDialog } from "./cancel-order-dialog";
import { ActivityFeed } from "./activity-feed";
import { ActivityTable } from "./activity-table";
import styles from "./activity-list.module.css";
import { useSpotPartner } from "@/lib/hooks/use-spot-partner";

const activityKey = (row: ActivityRow) => row.original.historyKey;

export function OrderActivityList({ orders, allOrders, search = "", onClearSearch, view = "open", onSelect, children, contained = false, network = "all", pair, scope = "" }: {
  orders: Order[]; view?: "open" | "history"; onSelect: (id: string, chainId: number) => void;
  allOrders?: Order[];
  search?: string; onClearSearch?: () => void;
  children?: ReactNode; contained?: boolean; network?: string; pair?: string; scope?: string;
}) {
  const { address } = useConnection();
  const { isDebugMode, partner } = useSpotPartner();
  const columns = getActivityColumns(isDebugMode);
  const [cancel, setCancel] = useState<Order>();
  const { filtered, pendingKeys, recentKey, recentAccount, query, symbolsLoading, symbolErrors, hasOrders } = useOrderActivity({
    orders, allOrders, search, view, network, pair, address,
  });
  const activePair = pair ?? "all";
  const total = filtered.length;
  const renderItem = useCallback((row: ActivityRow, index: number) => (
    <OrderActivityRow metadata={row} index={index} total={total} view={view} columns={columns} partner={partner}
      address={address} isPending={pendingKeys.has(row.original.historyKey)}
      isRecent={recentKey === row.original.historyKey && recentAccount === address?.toLowerCase()}
      onSelect={onSelect} onCancel={setCancel} />
  ), [total, view, columns, partner, address, pendingKeys, recentKey, recentAccount, onSelect]);
  // Search updates the existing virtual list; remount only when its scope changes.
  const filterScope = `${scope}:${network}:${address}:${view}:${activePair}`;
  return <div className={styles.root} data-activity-list data-view={view} data-debug={isDebugMode}>
    {query && symbolsLoading && <p role="status" className={styles.searchStatus}>Loading token symbols…</p>}
    {query && symbolErrors && <p role="status" className={styles.searchStatus}>Some token symbols couldn’t load. You can still search by token address.</p>}
    <ActivityTable>
      <div className={styles.header} data-activity-header aria-hidden="true">
        {columns.map(column => <div className={column.key === "placed" ? `${styles.field} ${styles.frozenCell}` : styles.field} key={column.key} data-column={column.key}>{column.label}</div>)}
        <div data-column="actions" />
      </div>
      {filtered.length > 0 && <ActivityFeed key={filterScope} items={filtered} itemKey={activityKey} label="Order activity" contained={contained} renderItem={renderItem} />}
    </ActivityTable>
    {!filtered.length && <div className={styles.empty}>{query && hasOrders ? <>
      <p role="status">{symbolsLoading ? "Searching orders…" : "No matching orders"}</p>
      {onClearSearch && <button data-hover="text" type="button" onClick={onClearSearch}>Clear search</button>}
    </> : children ?? <p>No open orders for this pair.</p>}</div>}

    {cancel && <CancelOrderDialog order={cancel} onClose={() => setCancel(undefined)} />}
  </div>;
}
