const FLOW_STEPS = [
  {
    detail:
      "Spot quotes use an ERC-20 input. When the selected input is native, wrap quote.request.inAmount into quote.request.inToken and wait for the transaction receipt.",
    meta: "Wallet · if native",
    title: "Wrap native input",
  },
  {
    detail:
      "When allowance for client.spenderAddress is below quote.request.inAmount, approve the exact input amount, confirm the receipt, and verify allowance.",
    meta: "Wallet · if required",
    title: "Approve configured spender",
  },
  {
    detail:
      "Refresh a stale Spot quote before signing. If output or minimum worsens, ask for review. Prepare with the reviewed minimum, then sign the original signingRequest unchanged.",
    meta: "SDK request · wallet signature",
    title: "Refresh and sign",
  },
  {
    detail:
      "Submit the exact prepared order and original signature. submitOrder returns an accepted order; waitForOrder confirms its completed fill.",
    meta: "Spot · completed order",
    title: "Submit and confirm",
  },
] as const;

export function SpotSwapFlow() {
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
          Start after the host selects Spot. Prepare the input, sign
          the prepared order, submit it, and confirm its completed fill.
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
