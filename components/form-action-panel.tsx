import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { FormPanel } from "./ui/form-panel";

export function FormActionPanel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <FormPanel
      variant="muted"
      className={cn(
        "flex w-full flex-col gap-3",
        className,
      )}
    >
      {children}
    </FormPanel>
  );
}
