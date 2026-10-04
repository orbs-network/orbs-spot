import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const navPillClass =
  "inline-flex h-10 items-center gap-2 rounded-full border border-border/70 bg-[var(--nav-pill-background)] px-3 text-sm font-semibold text-foreground transition-colors hover:border-primary/30 hover:bg-[var(--nav-pill-hover-background)] focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:outline-none";

export function NavPillButton({
  children,
  className,
  ref,
  ...props
}: ComponentProps<"button">) {
  return (
    <button
      data-nav-pill
      ref={ref}
      type="button"
      className={cn(navPillClass, className)}
      {...props}
    >
      {children}
    </button>
  );
}

