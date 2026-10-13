"use client";

import { AppLink } from "@/components/app-link";
import { ArrowRightIcon, Clock3Icon } from "lucide-react";
import { preserveFormTabInHref, useSelectedFormTab } from "@/lib/hooks/use-form-tab";
import { FormTab } from "@/lib/types";
import { useOpenOrders } from "./use-open-orders";
import styles from "./open-orders-panel.module.css";

export function OpenOrdersPanel() {
  const { count, isConnected, address } = useOpenOrders();
  const { selectedTab } = useSelectedFormTab();

  if (selectedTab.value === FormTab.SWAP || !isConnected || !address || count === 0) return null;

  return (
    <AppLink
      data-open-orders-summary
      href={preserveFormTabInHref("/orders?filter=open", selectedTab.value)}
      className={styles.summary}
    >
      <Clock3Icon aria-hidden="true" className={styles.icon} />
      <span role="status" aria-atomic="true">{count} open {count === 1 ? "order" : "orders"}</span>
      <ArrowRightIcon aria-hidden="true" className={styles.arrow} />
    </AppLink>
  );
}
