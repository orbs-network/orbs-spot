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
            "text-muted-foreground transition-colors hover:text-foreground",
            buttonClassName,
          )}
          aria-label={ariaLabel}
        >
          {children ?? <InfoIcon className={cn("size-4", iconClassName)} />}
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
}: {
  children: ReactNode;
  className?: string;
  hint?: ReactNode;
  textClassName?: string;
  tooltip?: string;
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
      <InfoTooltip tooltip={tooltip} />
      {hint && <span className="text-sm text-muted-foreground">{hint}</span>}
    </div>
  );
}
