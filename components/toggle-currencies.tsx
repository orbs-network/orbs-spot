import { ArrowDown, ArrowUpDown } from "lucide-react";

import { useActionHandlers } from "@/lib/hooks/use-action-handlers";
import { IS_ORBS } from "@/lib/partners/client";
import { toPresetAmount } from "@/lib/input-amount";

export function ToggleCurrencies({ outputAmount }: { outputAmount: string | undefined }) {
  const { handleToggleCurrencies, setInputAmount } = useActionHandlers();

  return (
    <div className="relative z-10 flex h-0 justify-center">
      <button
        type="button"
        data-toggle-currencies-button
        data-icon-button
        aria-label="Swap source and destination currencies"
        onClick={() => {
          setInputAmount(toPresetAmount(outputAmount ?? ""));
          handleToggleCurrencies();
        }}
        className="relative top-[-14px] flex h-[34px] w-[34px] cursor-pointer items-center justify-center rounded-xl border border-border/80 bg-card text-muted-foreground shadow-sm ring-4 ring-card transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-[6px] focus-visible:ring-primary/25"
      >
        {IS_ORBS ? <ArrowUpDown aria-hidden="true" className="size-5" /> : <ArrowDown aria-hidden="true" className="size-5" />}
      </button>
    </div>
  );
}
