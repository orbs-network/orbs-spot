"use client";

import type { Order } from "@orbs-network/spot-ui";
import { CopyIcon } from "lucide-react";
import { InfoTooltip } from "@/components/ui/form-label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTranslations } from "@/lib/use-translations";
import { useCopyToClipboard } from "@/lib/hooks/use-copy-to-clipboard";
import { makeEllipsisAddress } from "@/lib/utils";
import { formatDetailDate, getOrderTypeLabel } from "./format";
import styles from "./order-page.module.css";

export function CopyableIdentifier({ value, label }: { value: string; label: string }) {
  const { mutate: copy } = useCopyToClipboard({ successMessage: "Copied to clipboard", errorMessage: "Could not copy" });
  return <Tooltip action>
    <TooltipTrigger asChild>
      <button type="button" data-copy-identifier aria-label={`Copy ${label}`} onClick={() => copy(value)} className={styles.copyId}>
        <span className={styles.identifier}>{makeEllipsisAddress(value, { start: 8, end: 6 })}</span>
        <CopyIcon aria-hidden="true" className="size-3.5 shrink-0" />
      </button>
    </TooltipTrigger>
    <TooltipContent className="max-w-[min(360px,calc(100vw-32px))] break-all font-mono text-xs">{value}</TooltipContent>
  </Tooltip>;
}

export function OrderOverview({ order }: { order: Order }) {
  const t = useTranslations();
  const fields = [
    { label: "Order ID", tooltip: "The unique identifier for this order. Select the value to copy it.", value: <CopyableIdentifier value={order.id} label="order ID" /> },
    { label: t("orderType"), tooltip: "The execution strategy selected when this order was placed.", value: getOrderTypeLabel(order.type) },
    { label: t("createdAt"), tooltip: "When this order was placed, shown in your local time.", value: formatDetailDate(order.createdAt) },
    { label: t("expirationLabel"), tooltip: t("expirationTooltip"), value: formatDetailDate(order.deadline) },
  ];
  return <dl className={styles.overview} aria-label="Order summary">
    {fields.map(field => <div key={field.label}>
      <dt>{field.label}<InfoTooltip tooltip={field.tooltip} ariaLabel={`${field.label} info`} /></dt>
      <dd>{field.value}</dd>
    </div>)}
  </dl>;
}
