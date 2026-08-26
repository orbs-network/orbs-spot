import type { ReactNode } from "react";
import { InfoIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function InfoTooltip({
  ariaLabel = "More information",
  buttonClassName,
  children,
  iconClassName,
  tooltip,
}: {
  ariaLabel?: string;
  buttonClassName?: string;
  children?: ReactNode;
  iconClassName?: string;
  tooltip?: string;
}) {
  if (!tooltip) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            "rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35",
            buttonClassName,
          )}
          aria-label={ariaLabel}
        >
          {children ?? (
            <InfoIcon aria-hidden="true" className={cn("size-4", iconClassName)} />
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

export function FormLabel({
  children,
  className,
  hint,
  textClassName,
  tooltip,
  tooltipAriaLabel,
}: {
  children: ReactNode;
  className?: string;
  hint?: ReactNode;
  textClassName?: string;
  tooltip?: string;
  tooltipAriaLabel?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <p
        className={cn(
          "text-sm font-medium text-muted-foreground",
          textClassName,
        )}
      >
        {children}
      </p>
      <InfoTooltip tooltip={tooltip} ariaLabel={tooltipAriaLabel} />
      {hint && <span className="text-sm text-muted-foreground">{hint}</span>}
    </div>
  );
}
