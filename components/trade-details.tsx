"use client";

import { useId, useState, type ComponentProps, type MouseEvent, type ReactNode } from "react";
import { ChevronDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import styles from "./trade-details.module.css";

type TradeDetailsProps = Omit<ComponentProps<"div">, "children" | "role"> & {
  summary?: ReactNode;
  label: string;
  children: ReactNode;
} & ({ rate: ReactNode; heading?: never } | { heading: ReactNode; rate?: never });

export function TradeDetails({ rate, heading, summary, label, children, className, ...props }: TradeDetailsProps) {
  const [open, setOpen] = useState(false);
  const [instant, setInstant] = useState(false);
  const contentId = useId();
  const toggle = (event: MouseEvent<HTMLButtonElement>) => {
    setInstant(event.detail === 0);
    setOpen(value => !value);
  };

  return (
    <div {...props} data-trade-details data-open={open} data-instant={instant} className={cn(styles.root, className)}>
      {heading ? (
        <div className={cn(styles.trigger, styles.heading)}>
          <button type="button" data-hover="text" className={styles.headingToggle} aria-label={label} aria-expanded={open} aria-controls={contentId} onClick={toggle} />
          {heading}
          <ChevronDownIcon aria-hidden="true" className={styles.chevron} />
        </div>
      ) : <div className={styles.trigger}>
        <div className={styles.rate}>{rate}</div>
        <button type="button" data-hover="text" className={styles.detailsTrigger} aria-label={label} aria-expanded={open} aria-controls={contentId} onClick={toggle}>
          {summary && <span className={styles.summary} aria-hidden={open}>{summary}</span>}
          <ChevronDownIcon aria-hidden="true" className={styles.chevron} />
        </button>
      </div>}
      <div id={contentId} className={styles.collapse} inert={!open} aria-hidden={!open}>
        <div className={styles.clip}>
          <div className={styles.rows}>{children}</div>
        </div>
      </div>
    </div>
  );
}
