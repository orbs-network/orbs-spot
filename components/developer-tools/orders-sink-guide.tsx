"use client";

import Link from "next/link";
import {
  ArrowLeftIcon,
  CircleAlertIcon,
  Code2Icon,
  DatabaseIcon,
  HistoryIcon,
  ShieldCheckIcon,
} from "lucide-react";
import { useEffect, useMemo, useSyncExternalStore } from "react";

import {
  CANCEL_EXAMPLE_CODE_SNIPPET,
  CANCEL_EXAMPLE_DATA,
  FETCH_ORDERS_CODE_SNIPPET,
  FETCH_ORDERS_EXAMPLE_DATA,
  FETCH_ORDERS_EXAMPLE_RESPONSE_DATA,
  FETCH_ORDERS_EXAMPLE_URL,
  FULL_ORDER_FLOW_CODE_SNIPPET,
  getFetchOrdersResponseFieldExplanation,
  getSignatureFieldExplanation,
  SIGNATURE_EXAMPLE_DATA,
} from "./code-examples";
import { JsonInspectorPanel } from "./json-inspector";
import {
  preserveDeveloperModeInHref,
  useDeveloperMode,
} from "./use-developer-mode";
import { cn } from "@/lib/utils";

type DeveloperExample =
  | "full-flow"
  | "fetch-orders"
  | "cancel-order";

const IMPLEMENTATION_RULES = [
  "Native input is not supported. When native currency is selected, wrap it first and use the WToken address for permitted.token and witness.input.token.",
  "Build the order once; sign and submit that exact object.",
  "Use basePermitData.domain.verifyingContract as the approval spender.",
  "Wallet, domain, and order chain IDs must match.",
  "Use token base units, Unix seconds, and basis points.",
] as const;

const EXAMPLES: ReadonlyArray<{
  description: string;
  effect: string;
  example: DeveloperExample;
  icon: typeof Code2Icon;
  id: string;
  title: string;
}> = [
  {
    description: "One implementation file with reusable types kept separate.",
    effect: "Flow + types",
    example: "full-flow",
    icon: Code2Icon,
    id: "end-to-end",
    title: "Create an order end-to-end",
  },
  {
    description: "Query orders for a wallet, chain, and exchange.",
    effect: "HTTP GET",
    example: "fetch-orders",
    icon: DatabaseIcon,
    id: "fetch-orders",
    title: "Fetch order history",
  },
  {
    description: "Cancel a RePermit order using its digest.",
    effect: "On-chain transaction",
    example: "cancel-order",
    icon: HistoryIcon,
    id: "cancel-order",
    title: "Cancel order",
  },
] as const;

const EXAMPLE_BY_HASH = new Map(
  EXAMPLES.map((item) => [`#${item.id}`, item.example]),
);

const subscribeToHash = (onStoreChange: () => void) => {
  window.addEventListener("hashchange", onStoreChange);
  return () => window.removeEventListener("hashchange", onStoreChange);
};

const getHashSnapshot = () => window.location.hash;
const getServerHashSnapshot = () => "";

function ExamplePanel({ example }: { example: DeveloperExample }) {
  if (example === "full-flow") {
    return (
      <JsonInspectorPanel
        data={SIGNATURE_EXAMPLE_DATA}
        density="documentation"
        codeSnippet={FULL_ORDER_FLOW_CODE_SNIPPET}
        description=""
        explanation="The canonical flow: fetch trusted configuration, build one order, prepare funds, sign it, and submit the exact same object to Orders Sink. Replace the sample amounts, nonces, and timestamps with values from your application."
        explanationDisplay="subtitle"
        getFieldExplanation={getSignatureFieldExplanation}
        title="Create an order end-to-end"
      />
    );
  }

  if (example === "cancel-order") {
    return (
      <JsonInspectorPanel
        data={CANCEL_EXAMPLE_DATA}
        density="documentation"
        codeSnippet={CANCEL_EXAMPLE_CODE_SNIPPET}
        description=""
        explanation="Cancel a RePermit order on-chain using order.metadata.repermitDigest, then wait for the transaction receipt."
        explanationDisplay="subtitle"
        title="Cancel order example"
      />
    );
  }

  return (
    <JsonInspectorPanel
      data={FETCH_ORDERS_EXAMPLE_DATA}
      density="documentation"
      codeSnippet={FETCH_ORDERS_CODE_SNIPPET}
      curl={{
        method: "GET",
        url: FETCH_ORDERS_EXAMPLE_URL,
        headers: { Accept: "application/json" },
      }}
      description=""
      explanation="Fetch orders for the connected wallet and chain. The exchange address comes from the trusted base configuration."
      explanationDisplay="subtitle"
      getResponseFieldExplanation={getFetchOrdersResponseFieldExplanation}
      requestResponseTabs
      responseData={FETCH_ORDERS_EXAMPLE_RESPONSE_DATA}
      responseLabel="Orders JSON response"
      tabsInSectionHeader
      title="Fetch order history request"
    />
  );
}

export function OrdersSinkGuide() {
  const { isDeveloperMode } = useDeveloperMode();
  const hash = useSyncExternalStore(
    subscribeToHash,
    getHashSnapshot,
    getServerHashSnapshot,
  );
  const activeExample = EXAMPLE_BY_HASH.get(hash) ?? "full-flow";
  const activeItem = useMemo(
    () => EXAMPLES.find((item) => item.example === activeExample) ?? EXAMPLES[0],
    [activeExample],
  );

  useEffect(() => {
    if (window.location.hash !== `#${activeItem.id}`) return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(activeItem.id)?.scrollIntoView({ block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeItem.id]);

  return (
    <main className="w-full max-w-[1440px] pb-20 pt-5 sm:pt-8">
      <header className="mx-auto max-w-[1120px]">
        <Link
          href={preserveDeveloperModeInHref("/", isDeveloperMode)}
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeftIcon className="size-4" />
          Back to trading
        </Link>
        <div className="mt-7 max-w-[820px]">
          <span className="inline-flex rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
            Developer documentation
          </span>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Create orders with Orders Sink
          </h1>
          <p className="mt-4 max-w-[760px] text-sm leading-7 text-muted-foreground sm:text-base">
            A complete implementation reference for configuration, token
            preparation, EIP-712 signing, submission, order history, and
            cancellation. Use Dev Mode in the trading interface to inspect the
            same flow with your current form and wallet data.
          </p>
        </div>
      </header>

      <div className="mx-auto mt-10 max-w-[1120px]">
        <div className="min-w-0 space-y-8">
          <section
            id="security"
            className="scroll-mt-24 flex items-start gap-3 rounded-[18px] border border-amber-400/35 bg-amber-400/10 p-5"
          >
            <CircleAlertIcon className="mt-0.5 size-5 shrink-0 text-amber-300" />
            <div>
              <h2 className="font-semibold text-foreground">
                Treat GET /config as a security boundary
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                It supplies the approval spender and execution contracts. Use
                only the trusted Orbs Orders Sink HTTPS endpoint and an approved
                partner configuration. Do not make this endpoint user-editable
                or silently accept unexpected contract changes.
              </p>
            </div>
          </section>

          <section
            id="implementation-rules"
            className="scroll-mt-24 rounded-[20px] border border-primary/35 bg-primary/10 p-5 sm:p-6"
          >
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-[11px] bg-primary/18 text-primary">
                <ShieldCheckIcon className="size-5" />
              </span>
              <h2 className="text-lg font-semibold text-foreground">
                Implementation rules
              </h2>
            </div>
            <p className="mt-4 text-sm leading-6 text-foreground/85">
              Fetch trusted configuration, build one order, prepare and approve
              its input token, sign it, then submit the exact signed object.
            </p>
            <ul className="mt-4 grid gap-3 text-sm leading-6 text-foreground/85 sm:grid-cols-2">
              {IMPLEMENTATION_RULES.map((rule, index) => (
                <li
                  key={rule}
                  className={cn(
                    "relative pl-5 before:absolute before:left-0 before:top-[0.65em] before:size-1.5 before:rounded-full before:bg-primary",
                    index === 0 && "sm:col-span-2",
                  )}
                >
                  {rule}
                </li>
              ))}
            </ul>
          </section>

          <section id="examples" className="scroll-mt-24">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Code examples
            </p>
            <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-foreground">
                  Copy-ready implementation reference
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Examples use sample values. Dev Mode provides the current
                  form, wallet, request, and response values.
                </p>
              </div>
            </div>

            <div className="mt-5">
              <div
                role="tablist"
                aria-label="Code examples"
                className="flex snap-x gap-2 overflow-x-auto pb-2"
              >
                {EXAMPLES.map((item) => {
                  const Icon = item.icon;
                  const active = item.example === activeExample;
                  return (
                    <a
                      key={item.example}
                      id={item.id}
                      href={`#${item.id}`}
                      role="tab"
                      aria-controls="developer-code-example-panel"
                      aria-selected={active}
                      aria-current={active ? "location" : undefined}
                      className={cn(
                        "flex min-w-[220px] flex-1 snap-start scroll-mt-24 items-center gap-3 rounded-[14px] border px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35",
                        active
                          ? "border-primary/45 bg-primary/10"
                          : "border-border/75 bg-card/65 hover:border-primary/30 hover:bg-card",
                      )}
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-[9px] bg-primary/12 text-primary">
                        <Icon className="size-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-xs font-semibold text-foreground">
                          {item.title}
                        </span>
                        <span className="mt-1 block truncate text-[10px] text-muted-foreground">
                          <span className="text-primary/85">{item.effect}</span>
                          <span aria-hidden="true"> · </span>
                          {item.description}
                        </span>
                      </span>
                    </a>
                  );
                })}
              </div>

              <div
                id="developer-code-example-panel"
                role="tabpanel"
                aria-labelledby={activeItem.id}
                className="mt-2 h-[800px] min-w-0 overflow-hidden rounded-[20px] border border-border/80 bg-card shadow-2xl shadow-black/20 max-sm:h-[720px]"
              >
                <ExamplePanel key={activeExample} example={activeExample} />
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
