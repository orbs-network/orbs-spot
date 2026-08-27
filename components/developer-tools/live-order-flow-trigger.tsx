"use client";

import { lazy, Suspense, useRef } from "react";
import { Code2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useDerivedSwap } from "@/lib/hooks/use-derived-swap";

import { DeveloperModeSpotlight } from "./developer-mode-spotlight";
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
  const targetRef = useRef<HTMLDivElement>(null);
  const hasInputAmount = Boolean(inputAmount.trim());

  const trigger = (
    <Button
      data-developer-trigger
      data-developer-order-submit
      type="button"
      variant="outline"
      size="icon-lg"
      className="size-12 rounded-[14px] border-primary/35 text-primary hover:border-primary/60 hover:text-primary"
      aria-label="Submit developer order"
    >
      <Code2Icon aria-hidden="true" className="size-5" />
    </Button>
  );

  return (
    <>
      <div ref={targetRef} className="shrink-0" data-dev-submit-target>
        {hasInputAmount ? (
          <Suspense
            fallback={
              <Button
                data-developer-trigger
                data-developer-order-submit
                type="button"
                variant="outline"
                size="icon-lg"
                className="size-12 rounded-[14px] border-primary/35 text-primary"
                isLoading
                disabled
                aria-label="Loading developer order flow"
              />
            }
          >
            <LiveOrderFlowModal
              submitDisabled={submitDisabled}
              triggerTooltip="Run the order flow and inspect each action"
              trigger={trigger}
            />
          </Suspense>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                data-developer-trigger
                data-developer-order-submit
                type="button"
                variant="outline"
                size="icon-lg"
                className="size-12 rounded-[14px] border-primary/35 text-primary opacity-50 !cursor-not-allowed"
                aria-disabled="true"
                aria-label="Enter an amount to submit a developer order"
              >
                <Code2Icon aria-hidden="true" className="size-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Enter an amount to run the developer order flow
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      <DeveloperModeSpotlight targetRef={targetRef} variant="orders-sink" />
    </>
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
