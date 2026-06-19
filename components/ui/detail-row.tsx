import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { InfoTooltip } from "./form-label";

export function DetailRow({
  align = "center",
  children,
  className,
  hidden,
  label,
  labelClassName,
  tooltip,
  tone = "muted",
  truncateLabel,
  truncateValue,
  value,
  valueClassName,
}: {
  align?: "center" | "start";
  children?: ReactNode;
  className?: string;
  hidden?: boolean;
  label: ReactNode;
  labelClassName?: string;
  tooltip?: string;
  tone?: "foreground" | "muted";
  truncateLabel?: boolean;
  truncateValue?: boolean;
  value?: ReactNode;
  valueClassName?: string;
}) {
  if (hidden) return null;

  return (
    <div
      className={cn(
        "flex justify-between gap-4 text-sm",
        align === "center" ? "items-center" : "items-start",
        className,
      )}
    >
      <span
        className={cn(
          "flex min-w-0 items-center gap-1.5",
          tone === "foreground" ? "text-foreground" : "text-muted-foreground",
          labelClassName,
        )}
      >
        {typeof label === "string" ? (
          <span className={cn(truncateLabel && "truncate")}>{label}</span>
        ) : (
          label
        )}
        <InfoTooltip
          tooltip={tooltip}
          ariaLabel={typeof label === "string" ? `${label} info` : undefined}
          buttonClassName="flex size-4 shrink-0 cursor-pointer items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
          iconClassName="size-3.5"
        />
      </span>
      <span
        className={cn(
          "min-w-0 text-right font-medium",
          tone === "foreground" && "text-foreground",
          truncateValue && "truncate",
          valueClassName,
        )}
      >
        {value ?? children}
      </span>
    </div>
  );
}
