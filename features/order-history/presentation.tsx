"use client";

import { DialogTitle } from "@/components/ui/dialog";

import { createContext, useContext, useEffect, useRef } from "react";

export const HistoryPresentation = createContext<"modal" | "page" | "drawer">("modal");

export function HistoryTitle({ children, className }: React.ComponentProps<"h1">) {
  const presentation = useContext(HistoryPresentation);
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (presentation === "page") headingRef.current?.focus();
  }, [presentation, children]);
  return presentation === "page"
    ? <h1 ref={headingRef} tabIndex={-1} className={className}>{children}</h1>
    : <DialogTitle className={className}>{children}</DialogTitle>;
}
