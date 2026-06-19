import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

const messageVariants = {
  error: "border-destructive/60 bg-destructive/12 text-sm font-medium text-foreground",
  info: "border-border/60 bg-card/65",
} as const;

export function InlineMessage({
  children,
  className,
  icon,
  variant = "info",
}: {
  children: ReactNode;
  className?: string;
  icon?: ReactNode;
  variant?: keyof typeof messageVariants;
}) {
  return (
    <div
      className={cn(
        "flex gap-2 rounded-[14px] border p-3",
        messageVariants[variant],
        className,
      )}
    >
      {icon}
      {children}
    </div>
  );
}
