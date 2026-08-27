import {
  BlocksIcon,
  FileSignatureIcon,
  SendIcon,
  ShieldCheckIcon,
  WalletCardsIcon,
  WrapTextIcon,
} from "lucide-react";

const FLOW_STEPS = [
  {
    actor: "DEX app",
    detail:
      "Construct the SDK inline for the active chain and partner, then load the exact existing quote response from getLatestQuote(). Use “unknown” only when Orbs did not assign a partner ID.",
    icon: BlocksIcon,
    kind: "Existing response",
    title: "Load the Live Quote",
  },
  {
    actor: "DEX app",
    detail:
      "Read quote.inToken allowance for Permit2 and compare it with quote.inAmount before opening the wallet.",
    icon: ShieldCheckIcon,
    kind: "Read only",
    title: "Check Permit2 Allowance",
  },
  {
    actor: "Wallet",
    detail:
      "Liquidity Hub does not support native inToken. When the selected input is native, wrap quote.inAmount into quote.inToken and wait for the transaction receipt.",
    icon: WrapTextIcon,
    kind: "If native",
    title: "Wrap Native Input",
  },
  {
    actor: "Wallet",
    detail:
      "When the existing Permit2 allowance is below quote.inAmount, approve Permit2 and wait for the approval receipt.",
    icon: ShieldCheckIcon,
    kind: "If required",
    title: "Approve Permit2",
  },
  {
    actor: "Wallet",
    detail:
      "Call getLatestQuote() immediately before signing. It keeps the current payload when isFreshQuote() passes or fetches a replacement when stale. Treat the returned quote’s EIP-712 permitData as opaque SDK data.",
    icon: FileSignatureIcon,
    kind: "SDK request + signature",
    title: "Get Latest Quote & Sign",
  },
  {
    actor: "Liquidity Hub",
    detail:
      "Submit the same quote and wallet signature to swap(), wait for the returned transaction hash to be confirmed, and return only the receipt.",
    icon: SendIcon,
    kind: "SDK call + receipt",
    title: "Swap & Confirm",
  },
] as const;

export function LiquidityHubFlow() {
  return (
    <section
      id="end-to-end-flow"
      className="scroll-mt-24 rounded-[20px] border border-border/80 bg-card/65 p-5 sm:p-6"
    >
      <div className="max-w-[760px]">
        <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
          <WalletCardsIcon aria-hidden="true" className="size-4" />
          Transaction pipeline
        </span>
        <h2 className="mt-3 text-balance text-xl font-semibold text-foreground sm:text-2xl">
          End-to-End Swap Flow
        </h2>
        <p className="mt-2 text-pretty text-sm leading-6 text-muted-foreground">
          This execution flow starts only when a live quote response exists.
          It uses that response for preparation, checks freshness immediately
          before signing, and keeps the returned quote paired with its
          signature. Optional Wrap and Approve steps appear only when required.
        </p>
      </div>

      <ol className="mt-6">
        {FLOW_STEPS.map((step, index) => {
          const Icon = step.icon;
          const isLast = index === FLOW_STEPS.length - 1;

          return (
            <li
              key={step.title}
              className="relative grid min-w-0 grid-cols-[2.5rem_minmax(0,1fr)] gap-x-3 pb-5 last:pb-0 sm:grid-cols-[2.75rem_minmax(0,1fr)_auto] sm:gap-x-4"
            >
              {isLast ? null : (
                <span
                  aria-hidden="true"
                  className="absolute bottom-0 left-[1.22rem] top-10 w-px bg-gradient-to-b from-primary/55 to-border sm:left-[1.34rem]"
                />
              )}
              <span className="relative z-10 flex size-10 items-center justify-center rounded-xl border border-primary/30 bg-primary/12 text-primary sm:size-11">
                <Icon aria-hidden="true" className="size-4.5" />
              </span>
              <div className="min-w-0 rounded-[14px] border border-border/70 bg-background/35 px-4 py-3 sm:px-5">
                <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="font-mono text-[10px] font-semibold tabular-nums text-primary">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <h3 className="text-sm font-semibold text-foreground">
                    {step.title}
                  </h3>
                </div>
                <p className="mt-1.5 text-pretty text-xs leading-5 text-muted-foreground sm:text-sm">
                  {step.detail}
                </p>
              </div>
              <div className="col-start-2 mt-2 flex flex-wrap items-center gap-2 self-start sm:col-start-3 sm:row-start-1 sm:mt-0 sm:flex-col sm:items-end">
                <span className="rounded-full border border-border/75 bg-secondary/55 px-2.5 py-1 text-[10px] font-semibold text-foreground/80">
                  {step.actor}
                </span>
                <span className="rounded-full px-2.5 py-1 text-[10px] font-medium text-muted-foreground">
                  {step.kind}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
