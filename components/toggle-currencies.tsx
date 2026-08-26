import { ArrowDown } from "lucide-react";

import { useActionHandlers } from "@/lib/hooks/use-action-handlers";

export function ToggleCurrencies() {
  const { handleToggleCurrencies } = useActionHandlers();

  return (
    <div className="relative z-10 flex h-0 justify-center">
      <button
        type="button"
        data-toggle-currencies-button
        aria-label="Swap source and destination currencies"
        onClick={handleToggleCurrencies}
        className="relative top-[-14px] flex h-[34px] w-[34px] cursor-pointer items-center justify-center rounded-xl border border-border/80 bg-card text-muted-foreground shadow-sm ring-4 ring-card transition-colors hover:border-primary/25 hover:bg-secondary/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-[6px] focus-visible:ring-primary/25"
      >
        <ArrowDown aria-hidden="true" className="size-5" />
      </button>
    </div>
  );
}
