"use client";

import { memo } from "react";
import type { Order } from "@orbs-network/spot-ui";
import { ChevronDownIcon } from "lucide-react";
import { TokenFlow } from "./token-flow";
import { useOrderDisplay } from "./use-order-display";
import { OrderOverview } from "./order-overview";
import { OrderSchedule } from "./order-settings";
import { ExecutionSummary } from "./order-execution";
import { TradeActivity } from "./trade-activity";
import { OrderActions } from "./order-actions";
import styles from "./order-page.module.css";

export const OrderPageDetails = memo(function OrderPageDetails({ order, showActions = true }: { order: Order; showActions?: boolean }) {
  const { details, inputToken, outputToken } = useOrderDisplay(order);
  if (!details) return null;
  const progress = Number.isFinite(order.progress) ? Math.round(Math.max(0, Math.min(100, order.progress))) : 0;
  return <div className={styles.body}>
    <div className={styles.previewPair} aria-label="Order token pair">
      <TokenFlow
        input={{ symbol: inputToken?.symbol, address: order.srcTokenAddress }}
        output={{ symbol: outputToken?.symbol, address: order.dstTokenAddress }}
      />
    </div>
    <OrderOverview order={order} />
    <OrderSchedule details={details} />
    <ExecutionSummary details={details} />
    <details className={styles.executionDetails}>
      <summary><span>Trade activity</span><span className={styles.activityCount}>{progress}% ({details.fills.length}/{details.totalTrades})</span><ChevronDownIcon aria-hidden="true" className={styles.activityChevron} /></summary>
      <TradeActivity details={details} />
    </details>
    {showActions && <OrderActions order={order} />}
  </div>;
});
