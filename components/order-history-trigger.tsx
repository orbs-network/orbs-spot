"use client";

import { Button } from "@/components/ui/button";
import { HistoryIcon } from "lucide-react";

export function OrderHistoryTrigger({ onOpen }: { onOpen: () => void }) {
  return (
    <Button
      type="button"
      variant="outline"
      aria-label="Open order history"
      onClick={onOpen}
      className="h-10 shrink-0 gap-2 rounded-[12px] border-border/70 bg-secondary/35 px-3 text-sm font-semibold text-muted-foreground transition-colors hover:border-primary/25 hover:bg-secondary/40 hover:text-foreground"
    >
      <HistoryIcon aria-hidden="true" className="size-4" />
      <span>Orders</span>
    </Button>
  );
}
