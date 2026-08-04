import type * as React from "react";

import { cn } from "@/lib/utils";

const panelVariants = {
  default: "rounded-[18px] border border-border/70 bg-secondary/45 p-4",
  muted: "rounded-[18px] border border-border/70 bg-secondary/35 p-4",
} as const;

export function FormPanel({
  children,
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"div"> & {
  variant?: keyof typeof panelVariants;
}) {
  return (
    <div
      data-form-panel
      className={cn(panelVariants[variant], className)}
      {...props}
    >
      {children}
    </div>
  );
}
