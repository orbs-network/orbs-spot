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
import { useDeveloperMode } from "@/lib/hooks/use-developer-mode";

const SpotSwapDeveloperContent = lazy(async () => ({
  default: (await import("./spot-swap-developer-content"))
    .SpotSwapDeveloperContent,
}));

const SpotSwapQuoteDeveloperContent = lazy(async () => ({
  default: (await import("./spot-swap-quote-developer-content"))
    .SpotSwapQuoteDeveloperContent,
}));

function SpotSwapDeveloperTriggerContent({ mode }: { mode: DeveloperExecutionMode }) {
  const targetRef = useRef<HTMLDivElement>(null);
  const { isLoadingTrade, trade, inputCurrency, parsedInputAmount } = useDerivedSwap();
  const { address } = useConnection();
  const balance = useBalance(inputCurrency).wei;
  const hasQuote = Boolean(trade?.originalQuote && BN(parsedInputAmount).gt(0));
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
      <div ref={targetRef} className={mode === "demo" ? "w-24 shrink-0" : "min-w-0 flex-1"} data-dev-submit-target data-dev-flow="spot-swap" data-dev-execution-mode={mode}>
        {hasQuote ? (
          <Suspense fallback={<Button data-submit-button variant={variant} className="h-12 w-full rounded-[14px] px-3 text-sm" disabled isLoading>{label}</Button>}>
            <SpotSwapDeveloperContent mode={mode} trigger={trigger} />
          </Suspense>
        ) : (
          <Button data-submit-button variant={variant} className="h-12 w-full rounded-[14px] px-3 text-sm" disabled isLoading={isLoadingTrade}>{label}</Button>
        )}
      </div>
      {mode === "demo" && <DeveloperModeSpotlight targetRef={targetRef} variant="spot-swap" />}
    </>
  );
}

function SpotSwapQuoteDeveloperTriggerContent() {
  return (
    <Suspense fallback={<QuoteDeveloperButton loading />}>
      <SpotSwapQuoteDeveloperContent />
    </Suspense>
  );
}

function QuoteDeveloperButton({ loading = false }: { loading?: boolean }) {
  return (
    <Button
      data-developer-trigger
      data-developer-spot-swap-quote
      type="button"
      variant="outline"
      size="icon-sm"
      aria-busy={loading}
      aria-label={
        loading
          ? "Loading Spot quote developer tools"
          : "Inspect the Spot quote request and response"
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

export function SpotSwapDeveloperTrigger({ mode }: { mode: DeveloperExecutionMode }) {
  const { isDeveloperPlayground } = useDeveloperMode();
  const isSwapTab = useIsSwapTab();

  return isDeveloperPlayground && isSwapTab ? (
    <SpotSwapDeveloperTriggerContent mode={mode} />
  ) : null;
}

export function SpotSwapQuoteDeveloperTrigger() {
  const { isDeveloperPlayground } = useDeveloperMode();
  const isSwapTab = useIsSwapTab();

  return isDeveloperPlayground && isSwapTab ? (
    <SpotSwapQuoteDeveloperTriggerContent />
  ) : null;
}
