"use client";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useIsSpotTab } from "@/lib/hooks/use-form-tab";
import { HistoryIcon } from "lucide-react";
import { useOrderHistoryModal } from "./order-history-context";

export function OrderHistoryTrigger() {
  const isSpotTab = useIsSpotTab();
  const { openHistory } = useOrderHistoryModal();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Open order history"
          disabled={!isSpotTab}
          onClick={openHistory}
          className="size-11 shrink-0 rounded-full border-border/70 bg-secondary/35 text-muted-foreground shadow-none transition-colors hover:border-primary/50 hover:bg-secondary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-45"
        >
          <HistoryIcon className="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {isSpotTab
          ? "View order history"
          : "Order history is available on order tabs"}
      </TooltipContent>
    </Tooltip>
  );
}
