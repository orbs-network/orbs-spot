"use client";

import { OrderRate } from "./order-rate";

import { ArrowRightIcon } from "lucide-react";
import { useTranslations } from "@/lib/use-translations";
import { DetailRow } from "@/components/ui/detail-row";
import { formatOrderAmount, isZeroValue, type DerivedHistoryOrder } from "./format";
import styles from "./order-page.module.css";

export function ExecutionSummary({ details }: { details: DerivedHistoryOrder }) {
  const t = useTranslations();
  const price = <OrderRate value={details.executionPrice.ui} inputSymbol={details.inputToken?.symbol} outputSymbol={details.outputToken?.symbol} />;
  return <section className={styles.executionSummary} aria-label="Execution summary">
    <div data-review-details className={styles.previewSettings}>
    <DetailRow label="Filled" tooltip="Total input tokens sold and output tokens received across completed trades." className="grid-cols-[auto_minmax(0,1fr)]!">
      <span className={styles.filledTokens}>
        <span>{formatOrderAmount(details.inputAmountFilled.ui, details.inputToken)} {details.inputToken?.symbol}</span>
        <ArrowRightIcon aria-hidden="true" /><span className="sr-only">to</span>
        <span>{formatOrderAmount(details.outputAmountFilled.ui, details.outputToken)} {details.outputToken?.symbol}</span>
      </span>
    </DetailRow>
    {!isZeroValue(details.executionPrice.ui) && <DetailRow label={t("averageFillPrice")} tooltip={t("averageFillPriceTooltip")} value={price} />}
    </div>
  </section>;
}
