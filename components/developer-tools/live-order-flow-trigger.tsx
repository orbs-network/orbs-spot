"use client";

import { lazy, Suspense, useRef } from "react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useDerivedSwap } from "@/lib/hooks/use-derived-swap";

import type { DeveloperExecutionMode } from "./demo-order";
import { DeveloperModeSpotlight } from "./developer-mode-spotlight";
import { useDeveloperMode } from "./use-developer-mode";

const LiveOrderFlowModal = lazy(async () => ({
  default: (await import("./live-order-flow-modal")).LiveOrderFlowModal,
}));

function LiveOrderFlowTriggerContent({
  submitDisabled,
  mode,
}: {
  submitDisabled?: boolean;
  mode: DeveloperExecutionMode;
}) {
  const label = mode === "demo" ? "Demo" : "Place order";
  const variant = mode === "demo" ? "demo" : "default";
  const { inputAmount } = useDerivedSwap();
  const targetRef = useRef<HTMLDivElement>(null);
  const hasInputAmount = Boolean(inputAmount.trim());

  const trigger = (
    <Button
      data-submit-button
      data-developer-order-submit
      type="button"
      variant={variant}
      size="lg"
      className="h-12 w-full rounded-[14px] px-3 text-sm"
      aria-label={label}
      disabled={mode === "live" && submitDisabled}
    >
      {label}
    </Button>
  );

  return (
    <>
      <div ref={targetRef} className={mode === "demo" ? "w-24 shrink-0" : "min-w-0 flex-1"} data-dev-submit-target data-dev-flow="orders-sink" data-dev-execution-mode={mode}>
        {hasInputAmount ? (
          <Suspense
            fallback={
              <Button
                data-submit-button
                data-developer-order-submit
                type="button"
                variant={variant}
                size="lg"
                className="h-12 w-full rounded-[14px] px-3 text-sm"
                isLoading
                disabled
                aria-label="Loading developer order flow"
              >
                {label}
              </Button>
            }
          >
            <LiveOrderFlowModal
              mode={mode}
              submitDisabled={submitDisabled}
              triggerTooltip={mode === "demo" ? "Live data, simulated execution — no wallet or funds needed" : "Real execution — wallet and funds required"}
              trigger={trigger}
            />
          </Suspense>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                data-submit-button
                data-developer-order-submit
                type="button"
                variant={variant}
                size="lg"
                className="h-12 w-full rounded-[14px] px-3 text-sm opacity-50 !cursor-not-allowed"
                aria-disabled="true"
                aria-label={label}
              >
                {label}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Enter an amount to place an order
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      {mode === "demo" && <DeveloperModeSpotlight targetRef={targetRef} variant="orders-sink" />}
    </>
  );
}

export function LiveOrderFlowTrigger({
  submitDisabled,
  mode,
}: {
  submitDisabled?: boolean;
  mode: DeveloperExecutionMode;
}) {
  const { isDeveloperMode } = useDeveloperMode();

  return isDeveloperMode ? (
    <LiveOrderFlowTriggerContent mode={mode} submitDisabled={submitDisabled} />
  ) : null;
}
