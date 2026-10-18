"use client";

import { OrderRate } from "./order-rate";

import BN from "bignumber.js";
import { OrderStatus, type Order } from "@orbs-network/spot-ui";
import { ArrowRightIcon, ChevronDownIcon } from "lucide-react";
import { DetailRow } from "@/components/ui/detail-row";
import { useTranslations } from "@/lib/use-translations";
import { formatDisplayAmount } from "@/lib/token-display";
import { makeEllipsisAddress } from "@/lib/utils";
import { useOrderDisplay } from "./use-order-display";
import { formatDetailDate, formatDuration, getOrderTypeLabel, isZeroValue } from "./format";
import { OrderStatusLabel } from "./order-status-label";
import { DirectOrderCancelAction } from "./order-actions";
import { CopyableIdentifier } from "./order-overview";
import { TradeActivity } from "./trade-activity";
import { MarketTokenLink } from "./market-token-link";
import styles from "./transaction-details.module.css";

export function OrderTransactionDetails({ order }: { order: Order }) {
  const t = useTranslations();
  const { details, inputToken, outputToken } = useOrderDisplay(order);
  if (!details) return null;
  const closed = order.status !== OrderStatus.Open;
  const received = closed && BN(order.dstAmountFilled).gt(0);
  const inputSymbol = inputToken?.symbol || makeEllipsisAddress(order.srcTokenAddress);
  const outputSymbol = outputToken?.symbol || makeEllipsisAddress(order.dstTokenAddress);
  const price = (value: string) => <OrderRate value={value} inputSymbol={inputToken?.symbol} outputSymbol={outputToken?.symbol} />;
  const progress = Number.isFinite(order.progress) ? Math.round(Math.max(0, Math.min(100, order.progress))) : 0;

  return <div data-order-transaction className={styles.body}>
    <div className={styles.tokenPair} aria-label={`${inputSymbol} to ${outputSymbol}`}>
      <MarketTokenLink address={order.srcTokenAddress} chainId={order.chainId} symbol={inputSymbol} isLoading={false} className="text-lg font-medium" />
      <ArrowRightIcon aria-hidden="true" className={styles.arrow} />
      <MarketTokenLink address={order.dstTokenAddress} chainId={order.chainId} symbol={outputSymbol} isLoading={false} className="text-lg font-medium" />
    </div>
    <div className={styles.rows}>
      <div className={styles.identity}>
        <div className="min-w-0 flex-1">
          <div className={styles.status}><span>{getOrderTypeLabel(order.type)}</span><span className={styles.statusLabel}><OrderStatusLabel order={order} /></span></div>
          <div className={styles.metadata}>
            <p className={styles.date}>{formatDetailDate(order.createdAt)}</p>
            <div className={styles.orderId}><span>Order ID</span><CopyableIdentifier value={order.id} label="order ID" /></div>
          </div>
        </div>
      </div>
      <DetailRow label="Input amount" value={inputToken ? `${formatDisplayAmount(details.inputAmount.ui)} ${inputSymbol}` : "—"} />
      <DetailRow label={received ? t("averageFillPrice") : order.isMarketPrice ? t("marketPrice") : t("limitPrice")} tooltip={received ? t("averageFillPriceTooltip") : order.isMarketPrice ? t("marketOrderWarning") : t("limitPriceTooltip")} value={received ? price(details.executionPrice.ui) : order.isMarketPrice ? "Market price" : price(details.limitPrice.ui)} />
      {!isZeroValue(details.triggerPrice.ui) && <DetailRow label={t("triggerPrice")} tooltip={t("triggerPriceTooltip")} value={price(details.triggerPrice.ui)} />}
      <DetailRow label={t("expirationLabel")} tooltip={t("expirationTooltip")} value={formatDetailDate(order.deadline)} />
      {details.totalTrades > 1 && <>
        <DetailRow label={t("numberOfTrades")} tooltip={t("totalTradesTooltip")} value={details.totalTrades} />
        <DetailRow label={t("tradeIntervalLabel")} tooltip={t("tradeIntervalTooltip")} value={formatDuration(details.tradeInterval)} />
      </>}
    </div>
    <details className={styles.disclosure}>
      <summary aria-label={`Trade activity: ${progress}% filled, ${details.fills.length} of ${details.totalTrades} trades completed`}><span>Trade activity</span><span className={styles.meta}>{progress}% · {details.fills.length}/{details.totalTrades}</span><ChevronDownIcon aria-hidden="true" /></summary>
      <TradeActivity details={details} />
    </details>
    <div className={styles.cancel}><DirectOrderCancelAction order={order} className="min-h-11 w-full" /></div>
  </div>;
}
