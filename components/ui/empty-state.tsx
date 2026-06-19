import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function EmptyState({
  children,
  className,
  description,
  title,
}: {
  children?: ReactNode;
  className?: string;
  description?: ReactNode;
  title?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex min-h-[320px] flex-col items-center justify-center rounded-[18px] border border-dashed border-border/80 bg-secondary/20 px-6 text-center",
        className,
      )}
    >
      {children ?? (
        <>
          {title ? (
            <p className="text-base font-semibold text-foreground">{title}</p>
          ) : null}
          {description ? (
            <p className="mt-2 max-w-[256px] text-sm text-muted-foreground">
              {description}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
