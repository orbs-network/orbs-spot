"use client";

import { Code2Icon, FileJson2Icon, Loader2Icon } from "lucide-react";
import { lazy, Suspense, useRef } from "react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useDerivedSwap } from "@/lib/hooks/use-derived-swap";
import { useIsSwapTab } from "@/lib/hooks/use-form-tab";
import { DeveloperModeSpotlight } from "./developer-mode-spotlight";
import { useDeveloperMode } from "./use-developer-mode";

const LiquidityHubDeveloperContent = lazy(async () => ({
  default: (await import("./liquidity-hub-developer-content"))
    .LiquidityHubDeveloperContent,
}));

const LiquidityHubQuoteDeveloperContent = lazy(async () => ({
  default: (await import("./liquidity-hub-quote-developer-content"))
    .LiquidityHubQuoteDeveloperContent,
}));

function LiquidityHubDeveloperTriggerContent() {
  const targetRef = useRef<HTMLDivElement>(null);
  const { isLoadingTrade, trade } = useDerivedSwap();
  const quote = trade?.originalQuote as { error?: string } | undefined;
  const hasQuote = Boolean(quote && !quote.error);
  const isWaitingForQuote = isLoadingTrade && !hasQuote;
  const trigger = (
    <Button
      data-developer-trigger
      data-developer-liquidity-hub
      type="button"
      variant="outline"
      size="icon-lg"
      className="size-12 rounded-[14px] border-primary/35 text-primary hover:border-primary/60 hover:text-primary"
      aria-label="Inspect the complete Liquidity Hub flow"
    >
      <Code2Icon aria-hidden="true" className="size-5" />
    </Button>
  );

  return (
    <>
      <div ref={targetRef} className="shrink-0" data-dev-submit-target>
        {hasQuote ? (
          <Suspense
            fallback={
              <Button
                data-developer-trigger
                type="button"
                variant="outline"
                size="icon-lg"
                className="size-12 rounded-[14px] border-primary/35 text-primary"
                isLoading
                disabled
                aria-label="Loading Liquidity Hub developer tools"
              />
            }
          >
            <LiquidityHubDeveloperContent trigger={trigger} />
          </Suspense>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                data-developer-trigger
                data-developer-liquidity-hub
                type="button"
                variant="outline"
                size="icon-lg"
                aria-busy={isWaitingForQuote}
                aria-disabled="true"
                aria-label={
                  isWaitingForQuote
                    ? "Waiting for a Liquidity Hub quote"
                    : "Liquidity Hub developer flow requires a quote"
                }
                className="size-12 rounded-[14px] border-primary/35 text-primary opacity-50 !cursor-not-allowed"
              >
                {isWaitingForQuote ? (
                  <Loader2Icon
                    aria-hidden="true"
                    className="size-5 motion-safe:animate-spin"
                  />
                ) : (
                  <Code2Icon aria-hidden="true" className="size-5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {isWaitingForQuote
                ? "Waiting for the current Liquidity Hub quote"
                : "Enter an amount and wait for a quote to inspect the live flow"}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      <DeveloperModeSpotlight
        targetRef={targetRef}
        variant="liquidity-hub"
      />
    </>
  );
}

function LiquidityHubQuoteDeveloperTriggerContent() {
  return (
    <Suspense fallback={<QuoteDeveloperButton loading />}>
      <LiquidityHubQuoteDeveloperContent />
    </Suspense>
  );
}

function QuoteDeveloperButton({ loading = false }: { loading?: boolean }) {
  return (
    <Button
      data-developer-trigger
      data-developer-liquidity-hub-quote
      type="button"
      variant="outline"
      size="icon-sm"
      aria-busy={loading}
      aria-label={
        loading
          ? "Loading Liquidity Hub quote developer tools"
          : "Inspect the Liquidity Hub quote request and response"
      }
      className="relative size-8 rounded-[10px] border-primary/35 bg-primary/[0.08] text-primary after:absolute after:-inset-1.5 after:content-['']"
    >
      {loading ? (
        <Loader2Icon
          aria-hidden="true"
          className="size-4 motion-safe:animate-spin"
        />
      ) : (
        <FileJson2Icon aria-hidden="true" className="size-4" />
      )}
    </Button>
  );
}

export function LiquidityHubDeveloperTrigger() {
  const { isDeveloperMode } = useDeveloperMode();
  const isSwapTab = useIsSwapTab();

  return isDeveloperMode && isSwapTab ? (
    <LiquidityHubDeveloperTriggerContent />
  ) : null;
}

export function LiquidityHubQuoteDeveloperTrigger() {
  const { isDeveloperMode } = useDeveloperMode();
  const isSwapTab = useIsSwapTab();

  return isDeveloperMode && isSwapTab ? (
    <LiquidityHubQuoteDeveloperTriggerContent />
  ) : null;
}
