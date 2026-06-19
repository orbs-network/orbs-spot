import type * as React from "react";

import { cn } from "@/lib/utils";

export function FormNumberField({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex min-w-0 cursor-text items-center rounded-[14px] border border-border/80 bg-transparent px-4 transition-colors focus-within:border-primary",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
