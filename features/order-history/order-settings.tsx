"use client";

import { OrderRate } from "./order-rate";

import { useTranslations } from "@/lib/use-translations";
import { DetailRow } from "@/components/ui/detail-row";
import { formatOrderAmount, formatDuration, isZeroValue, type DerivedHistoryOrder } from "./format";
import styles from "./order-page.module.css";

export function OrderSchedule({ details }: { details: DerivedHistoryOrder }) {
  const t = useTranslations();
  const price = (value: string) => <OrderRate value={value} inputSymbol={details.inputToken?.symbol} outputSymbol={details.outputToken?.symbol} />;
  const hasLimit = !details.original.isMarketPrice && !isZeroValue(details.limitPrice.ui);
  const hasTrigger = !isZeroValue(details.triggerPrice.ui);
  if (!hasLimit && !hasTrigger && details.totalTrades <= 1) return null;
  return <section data-review-details className={styles.previewSettings} aria-label="Order settings">
    {hasLimit && <DetailRow label={t("limitPrice")} tooltip={t("limitPriceTooltip")} value={price(details.limitPrice.ui)} />}
    {hasTrigger && <DetailRow label={t("triggerPrice")} tooltip={t("triggerPriceTooltip")} value={price(details.triggerPrice.ui)} />}
    {details.totalTrades > 1 && <>
      <DetailRow label={t("individualTradeSize")} tooltip={t("tradeSizeTooltip")}>{formatOrderAmount(details.inputAmountPerTrade.ui, details.inputToken)} {details.inputToken?.symbol}</DetailRow>
      <DetailRow label={t("numberOfTrades")} tooltip={t("totalTradesTooltip")} value={details.totalTrades} />
      <DetailRow label={t("tradeIntervalLabel")} tooltip={t("tradeIntervalTooltip")} value={formatDuration(details.tradeInterval)} />
    </>}
  </section>;
}
