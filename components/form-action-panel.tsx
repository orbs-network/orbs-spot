import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function FormActionPanel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex w-full flex-col gap-3 rounded-[18px] border border-border/70 bg-secondary/35 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]",
        className,
      )}
    >
      {children}
    </div>
  );
}
