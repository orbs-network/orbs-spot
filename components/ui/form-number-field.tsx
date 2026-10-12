"use client";

import type * as React from "react";

import { cn } from "@/lib/utils";

export function FormNumberField({
  children,
  className,
  onClick,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-number-field
      className={cn(
        "flex min-w-0 cursor-text items-center rounded-[14px] border border-border/80 bg-transparent px-4 transition-colors focus-within:border-primary",
        className,
      )}
      {...props}
      onClick={(event) => {
        onClick?.(event);
        if (
          event.defaultPrevented ||
          (event.target instanceof Element &&
            event.target.closest(
              'input, button, a, select, textarea, [role="button"], [role="combobox"], [contenteditable="true"]',
            ))
        ) {
          return;
        }

        event.currentTarget
          .querySelector<HTMLInputElement>('input:not(:disabled):not([type="hidden"])')
          ?.focus();
      }}
    >
      {children}
    </div>
  );
}
