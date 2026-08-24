"use client";

import { lazy, Suspense } from "react";
import { Code2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useDerivedSwap } from "@/lib/hooks/use-derived-swap";

import { useDeveloperMode } from "./use-developer-mode";

const LiveOrderFlowModal = lazy(async () => ({
  default: (await import("./live-order-flow-modal")).LiveOrderFlowModal,
}));

function LiveOrderFlowTriggerContent({
  submitDisabled,
}: {
  submitDisabled?: boolean;
}) {
  const { inputAmount } = useDerivedSwap();

  if (!inputAmount.trim()) return null;

  return (
    <Suspense fallback={null}>
      <LiveOrderFlowModal
        submitDisabled={submitDisabled}
        triggerTooltip="Run the order flow and inspect each action. Available after entering an amount."
        trigger={
          <Button
            data-developer-trigger
            type="button"
            variant="outline"
            size="icon-lg"
            className="size-12 rounded-[14px] border-primary/35 text-primary hover:border-primary/60 hover:text-primary"
            aria-label="Open order flow"
          >
            <Code2Icon className="size-5" />
          </Button>
        }
      />
    </Suspense>
  );
}

export function LiveOrderFlowTrigger({
  submitDisabled,
}: {
  submitDisabled?: boolean;
}) {
  const { isDeveloperMode } = useDeveloperMode();

  return isDeveloperMode ? (
    <LiveOrderFlowTriggerContent submitDisabled={submitDisabled} />
  ) : null;
}
