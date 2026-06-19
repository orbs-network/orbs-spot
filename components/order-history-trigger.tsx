"use client";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { HistoryIcon } from "lucide-react";

export function OrderHistoryTrigger({ onOpen }: { onOpen: () => void }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Open order history"
          onClick={onOpen}
          className="size-11 shrink-0 rounded-[12px] border-border/70 bg-secondary/35 text-muted-foreground shadow-none transition-colors hover:border-primary/25 hover:bg-secondary/40 hover:text-foreground"
        >
          <HistoryIcon className="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>View order history</TooltipContent>
    </Tooltip>
  );
}
