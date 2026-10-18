import type { ComponentProps } from "react";
import { ChevronDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export const compactSelectorTriggerClass =
  "min-h-9 w-auto max-w-full shrink-0 rounded-lg px-2 text-xs sm:max-w-[180px]";

export function SelectorTrigger({ children, className, ...props }: ComponentProps<"button">) {
  return (
    <button
      {...props}
      type="button"
      data-slot="select-trigger"
      data-selector-trigger
      className={cn("flex min-h-11 w-full items-center justify-between gap-2 rounded-[14px] border border-border/80 bg-transparent px-3 text-sm font-medium text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 disabled:cursor-wait disabled:opacity-60", className)}
    >
      <span className="flex min-w-0 items-center truncate">{children}</span>
      <ChevronDownIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
    </button>
  );
}
