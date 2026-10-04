const FLOW_STEPS = [
  {
    detail:
      "Liquidity Hub does not support native inToken. When the selected input is native, wrap quote.inAmount into quote.inToken and wait for the transaction receipt.",
    meta: "Wallet · if native",
    title: "Wrap native input",
  },
  {
    detail:
      "When Permit2 allowance is below quote.inAmount, approve the exact quoted input amount and wait for a successful receipt.",
    meta: "Wallet · if required",
    title: "Approve Permit2",
  },
  {
    detail:
      "Refresh the Liquidity Hub quote immediately before signing. If its minAmountOut is lower, ask the user to review the updated quote and confirm again; otherwise sign its unchanged EIP-712 data.",
    meta: "SDK request · wallet signature",
    title: "Refresh and sign",
  },
  {
    detail:
      "Submit the same fresh quote and signature, then wait for a successful on-chain receipt before reporting completion.",
    meta: "Liquidity Hub · on-chain receipt",
    title: "Submit and confirm",
  },
] as const;

export function LiquidityHubFlow() {
  return (
    <section
      id="end-to-end-flow"
      aria-labelledby="integration-flow-title"
      className="scroll-mt-24 border-t border-border/80 pt-6"
    >
      <div className="max-w-2xl">
        <h3
          id="integration-flow-title"
          className="text-lg font-semibold tracking-tight text-foreground"
        >
          Integration flow
        </h3>
        <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
          Start after the host selects Liquidity Hub. Prepare the input, sign
          the refreshed quote, submit it, and confirm the receipt.
        </p>
      </div>

      <ol className="mt-4 divide-y divide-border/70 border-y border-border/70">
        {FLOW_STEPS.map((step, index) => {
          return (
            <li
              key={step.title}
              className="grid min-w-0 grid-cols-[2rem_minmax(0,1fr)] gap-3 py-3.5 sm:grid-cols-[2rem_minmax(0,1fr)_auto] sm:items-start"
            >
              <span className="pt-0.5 font-mono text-xs font-semibold tabular-nums text-primary">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0">
                <h4 className="text-sm font-semibold text-foreground">
                  {step.title}
                </h4>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {step.detail}
                </p>
              </div>
              <span className="col-start-2 text-xs text-muted-foreground sm:col-start-3 sm:row-start-1 sm:pt-0.5">
                {step.meta}
              </span>
            </li>
          );
        })}
      </ol>

    </section>
  );
}
