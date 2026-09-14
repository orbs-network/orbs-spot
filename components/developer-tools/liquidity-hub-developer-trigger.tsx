"use client";

import { FileJson2Icon, Loader2Icon } from "lucide-react";
import { lazy, Suspense, useRef } from "react";

import { Button } from "@/components/ui/button";
import BN from "bignumber.js";
import { useConnection } from "wagmi";
import { useBalance } from "@/lib/hooks/use-balances";
import type { DeveloperExecutionMode } from "./demo-order";
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

function LiquidityHubDeveloperTriggerContent({ mode }: { mode: DeveloperExecutionMode }) {
  const targetRef = useRef<HTMLDivElement>(null);
  const { isLoadingTrade, trade, inputCurrency, parsedInputAmount } = useDerivedSwap();
  const { address } = useConnection();
  const balance = useBalance(inputCurrency).wei;
  const quote = trade?.originalQuote as { error?: string } | undefined;
  const hasQuote = Boolean(quote && !quote.error && BN(parsedInputAmount).gt(0));
  const label = mode === "demo" ? "Demo" : "Swap";
  const variant = mode === "demo" ? "demo" : "default";
  const disabled = !hasQuote || (mode === "live" && (!address || !BN(balance ?? "0").gte(parsedInputAmount)));
  const trigger = (
    <Button data-submit-button type="button" variant={variant} size="lg"
      className="h-12 w-full rounded-[14px] px-3 text-sm" disabled={disabled}>
      {label}
    </Button>
  );
  return (
    <>
      <div ref={targetRef} className={mode === "demo" ? "w-24 shrink-0" : "min-w-0 flex-1"} data-dev-submit-target data-dev-flow="liquidity-hub" data-dev-execution-mode={mode}>
        {hasQuote ? (
          <Suspense fallback={<Button data-submit-button variant={variant} className="h-12 w-full rounded-[14px] px-3 text-sm" disabled isLoading>{label}</Button>}>
            <LiquidityHubDeveloperContent mode={mode} trigger={trigger} />
          </Suspense>
        ) : (
          <Button data-submit-button variant={variant} className="h-12 w-full rounded-[14px] px-3 text-sm" disabled isLoading={isLoadingTrade}>{label}</Button>
        )}
      </div>
      {mode === "demo" && <DeveloperModeSpotlight targetRef={targetRef} variant="liquidity-hub" />}
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

export function LiquidityHubDeveloperTrigger({ mode }: { mode: DeveloperExecutionMode }) {
  const { isDeveloperMode } = useDeveloperMode();
  const isSwapTab = useIsSwapTab();

  return isDeveloperMode && isSwapTab ? (
    <LiquidityHubDeveloperTriggerContent mode={mode} />
  ) : null;
}

export function LiquidityHubQuoteDeveloperTrigger() {
  const { isDeveloperMode } = useDeveloperMode();
  const isSwapTab = useIsSwapTab();

  return isDeveloperMode && isSwapTab ? (
    <LiquidityHubQuoteDeveloperTriggerContent />
  ) : null;
}
