"use client";

import { forwardRef, useCallback, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { Virtuoso } from "react-virtuoso";
import { normalizeTimestamp } from "./format";
import styles from "./activity-list.module.css";

const List = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<"div">>(function List(props, ref) {
  return <div {...props} ref={ref} role="list" />;
});
const components = { List };

/** The service returns complete network results; virtualize them as one continuous feed. */
export function ActivityFeed<T>({ items, itemKey, renderItem, label, contained = false }: {
  items: T[];
  itemKey: (item: T) => string;
  renderItem: (item: T, index: number) => ReactNode;
  label: string;
  contained?: boolean;
}) {
  const computeItemKey = useCallback((_: number, item: T) => itemKey(item), [itemKey]);
  const itemContent = useCallback((index: number, item: T) => renderItem(item, index), [renderItem]);
  return <div className={styles.feed} role="region" aria-label={label}>
    <Virtuoso
      useWindowScroll={!contained}
      style={contained ? { height: "min(560px, 65dvh)" } : undefined}
      data={items}
      components={components}
      computeItemKey={computeItemKey}
      increaseViewportBy={400}
      itemContent={itemContent}
    />
  </div>;
}

export function ActivityTime({ timestamp }: { timestamp?: number }) {
  const milliseconds = normalizeTimestamp(timestamp);
  if (!milliseconds) return <span>—</span>;
  const date = new Date(milliseconds);
  const short = date.toDateString() === new Date().toDateString()
    ? date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    : date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const day = date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  const time = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return <time className={styles.time} dateTime={date.toISOString()} aria-label={`${day}, ${time}`}>
    <span className={styles.shortTime} aria-hidden="true">{short}</span>
    <span className={styles.fullTime} aria-hidden="true">{day}<br />{time}</span>
  </time>;
}
