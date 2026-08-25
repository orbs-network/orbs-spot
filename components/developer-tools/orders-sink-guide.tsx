"use client";

import Link from "next/link";
import {
  ArrowLeftIcon,
  BracesIcon,
  CircleAlertIcon,
  Code2Icon,
  DatabaseIcon,
  FileSignatureIcon,
  HistoryIcon,
  ShieldCheckIcon,
} from "lucide-react";
import { useEffect, useMemo, useSyncExternalStore } from "react";

import {
  APPROVE_TOKEN_CODE_SNIPPET,
  APPROVE_TOKEN_EXAMPLE_DATA,
  BASE_PERMIT_DATA_RESPONSE,
  CANCEL_EXAMPLE_CODE_SNIPPET,
  CANCEL_EXAMPLE_DATA,
  CREATE_ORDER_CODE_SNIPPET,
  CREATE_ORDER_EXAMPLE_DATA,
  CREATE_ORDER_EXAMPLE_RESPONSE_DATA,
  CREATE_ORDER_EXAMPLE_URL,
  FETCH_ORDERS_CODE_SNIPPET,
  FETCH_ORDERS_EXAMPLE_DATA,
  FETCH_ORDERS_EXAMPLE_RESPONSE_DATA,
  FETCH_ORDERS_EXAMPLE_URL,
  FULL_ORDER_FLOW_CODE_SNIPPET,
  getFetchOrdersResponseFieldExplanation,
  getPermitDataFieldExplanation,
  getSignatureFieldExplanation,
  PERMIT_CONFIG_CODE_SNIPPET,
  PERMIT_CONFIG_REQUEST_DATA,
  PERMIT_CONFIG_REQUEST_URL,
  SIGNATURE_EXAMPLE_CODE_SNIPPET,
  SIGNATURE_EXAMPLE_DATA,
} from "./code-examples";
import { JsonInspectorPanel } from "./json-inspector";
import { cn } from "@/lib/utils";

type DeveloperExample =
  | "full-flow"
  | "permit-config"
  | "approve-token"
  | "signature"
  | "create-order"
  | "fetch-orders"
  | "cancel-order";

const INTEGRATION_STEPS = [
  { title: "Get base config", owner: "Orders Sink", effect: "HTTP read" },
  { title: "Build one order", owner: "Application", effect: "Local data" },
  { title: "Check allowance", owner: "RPC", effect: "Read-only" },
  { title: "Wrap / approve", owner: "Wallet", effect: "On-chain" },
  { title: "Sign EIP-712", owner: "Wallet", effect: "No transaction" },
  { title: "Submit signed order", owner: "Orders Sink", effect: "HTTP POST" },
] as const;

const IMPLEMENTATION_RULES = [
  "Build the order once; sign and submit that exact object.",
  "Use basePermitData.domain.verifyingContract as the approval spender.",
  "Wallet, domain, and order chain IDs must match.",
  "Use token base units, Unix seconds, and basis points.",
  "Wrap native input first and use the wrapped-token address in the order.",
] as const;

const ORDER_FIELDS = [
  {
    name: "permitted.amount · input.maxAmount",
    description: "Total source amount in the token's smallest unit.",
  },
  {
    name: "input.amount · output.limit",
    description: "Source amount and minimum destination amount per fill.",
  },
  {
    name: "epoch · start · deadline",
    description: "Fill interval and validity timestamps, all in seconds.",
  },
  {
    name: "slippage",
    description: "Basis points; 100 basis points equals 1%.",
  },
  {
    name: "swapper · recipient · account",
    description: "The connected wallet unless another recipient is explicit.",
  },
  {
    name: "domain.chainId · witness.chainid",
    description: "Both must match the connected wallet network.",
  },
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
    description: "The complete copy-ready integration path.",
    effect: "Recommended start",
    example: "full-flow",
    icon: Code2Icon,
    id: "end-to-end",
    title: "Create an order end-to-end",
  },
  {
    description: "Load trusted contracts and EIP-712 base data.",
    effect: "GET /config",
    example: "permit-config",
    icon: BracesIcon,
    id: "config",
    title: "Get base permit data",
  },
  {
    description: "Read allowance and approve only when required.",
    effect: "RPC + optional transaction",
    example: "approve-token",
    icon: ShieldCheckIcon,
    id: "allowance",
    title: "Check and approve token",
  },
  {
    description: "Sign the populated order without sending a transaction.",
    effect: "Wallet signature",
    example: "signature",
    icon: FileSignatureIcon,
    id: "sign",
    title: "Sign order (EIP-712)",
  },
  {
    description: "POST the signature and exact signed order object.",
    effect: "HTTP POST",
    example: "create-order",
    icon: Code2Icon,
    id: "submit",
    title: "Submit signed order",
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

  if (example === "permit-config") {
    return (
      <JsonInspectorPanel
        data={PERMIT_CONFIG_REQUEST_DATA}
        density="documentation"
        codeSnippet={PERMIT_CONFIG_CODE_SNIPPET}
        curl={{
          method: "GET",
          url: PERMIT_CONFIG_REQUEST_URL,
          headers: { Accept: "application/json" },
        }}
        description=""
        explanation='Fetch unchanged base permit data from the trusted Orders Sink endpoint. Use the partner ID assigned by Orbs, or "unknown" when no ID was assigned.'
        explanationDisplay="subtitle"
        getFieldExplanation={getPermitDataFieldExplanation}
        responseData={BASE_PERMIT_DATA_RESPONSE}
        responseLabel="Base permit data JSON response"
        requestResponseTabs
        tabsInSectionHeader
        title="Get base permit data"
      />
    );
  }

  if (example === "approve-token") {
    return (
      <JsonInspectorPanel
        data={APPROVE_TOKEN_EXAMPLE_DATA}
        density="documentation"
        codeSnippet={APPROVE_TOKEN_CODE_SNIPPET}
        description=""
        explanation="Check ERC-20 allowance first and request approval only when required. The spender is basePermitData.domain.verifyingContract."
        explanationDisplay="subtitle"
        title="Check and approve token"
      />
    );
  }

  if (example === "signature") {
    return (
      <JsonInspectorPanel
        data={SIGNATURE_EXAMPLE_DATA}
        density="documentation"
        codeSnippet={SIGNATURE_EXAMPLE_CODE_SNIPPET}
        description=""
        explanation="Populate one order object, sign it with Wagmi, parse the signature into v/r/s, and preserve that exact order for submission."
        explanationDisplay="subtitle"
        getFieldExplanation={getSignatureFieldExplanation}
        title="Sign order example"
      />
    );
  }

  if (example === "create-order") {
    return (
      <JsonInspectorPanel
        data={CREATE_ORDER_EXAMPLE_DATA}
        density="documentation"
        codeSnippet={CREATE_ORDER_CODE_SNIPPET}
        curl={{
          method: "POST",
          url: CREATE_ORDER_EXAMPLE_URL,
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
        }}
        description=""
        explanation='Submit { signature, order, status: "pending" }. The order must be the exact message previously signed by the wallet.'
        explanationDisplay="subtitle"
        getResponseFieldExplanation={getFetchOrdersResponseFieldExplanation}
        requestResponseTabs
        responseData={CREATE_ORDER_EXAMPLE_RESPONSE_DATA}
        responseLabel="Created order JSON response"
        tabsInSectionHeader
        title="Submit signed order request"
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
          href="/"
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

      <div className="mx-auto mt-10 grid max-w-[1120px] gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <nav
            aria-label="Orders Sink guide sections"
            className="sticky top-24 rounded-[16px] border border-border/75 bg-card/70 p-3"
          >
            <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              On this page
            </p>
            {[
              ["overview", "Overview"],
              ["security", "Security boundary"],
              ["order-flow", "Order creation flow"],
              ["implementation-rules", "Implementation rules"],
              ["order-fields", "Calculated fields"],
              ["examples", "Code examples"],
            ].map(([id, label]) => (
              <a
                key={id}
                href={`#${id}`}
                className="block rounded-[9px] px-2 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary/55 hover:text-foreground"
              >
                {label}
              </a>
            ))}
          </nav>
        </aside>

        <div className="min-w-0 space-y-8">
          <section
            id="overview"
            className="scroll-mt-24 rounded-[20px] border border-border/75 bg-card/70 p-5 sm:p-7"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
              Overview
            </p>
            <h2 className="mt-2 text-xl font-semibold text-foreground sm:text-2xl">
              One order object from construction to submission
            </h2>
            <p className="mt-3 max-w-[720px] text-sm leading-6 text-muted-foreground">
              Fetch fixed protocol configuration, layer in values calculated by
              your application, and construct the order once. Prepare the input
              token, sign that object, and POST the same object with its wallet
              signature.
            </p>
          </section>

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

          <section id="order-flow" className="scroll-mt-24">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Order creation flow
              </p>
              <h2 className="mt-2 text-xl font-semibold text-foreground">
                Know who performs each step
              </h2>
            </div>
            <ol className="mt-4 grid gap-3 sm:grid-cols-2">
              {INTEGRATION_STEPS.map((step, index) => (
                <li
                  key={step.title}
                  className="flex items-center gap-3 rounded-[15px] border border-border/75 bg-card/70 p-4"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-primary/12 font-mono text-xs font-semibold text-primary">
                    {index + 1}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {step.title}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {step.owner} · {step.effect}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
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
            <ul className="mt-5 grid gap-3 text-sm leading-6 text-foreground/85 sm:grid-cols-2">
              {IMPLEMENTATION_RULES.map((rule, index) => (
                <li
                  key={rule}
                  className={cn(
                    "relative pl-5 before:absolute before:left-0 before:top-[0.65em] before:size-1.5 before:rounded-full before:bg-primary",
                    index === IMPLEMENTATION_RULES.length - 1 && "sm:col-span-2",
                  )}
                >
                  {rule}
                </li>
              ))}
            </ul>
          </section>

          <section id="order-fields" className="scroll-mt-24">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Calculated fields
            </p>
            <h2 className="mt-2 text-xl font-semibold text-foreground">
              Values your application must populate
            </h2>
            <dl className="mt-4 grid overflow-hidden rounded-[18px] border border-border/75 bg-card/70 sm:grid-cols-2">
              {ORDER_FIELDS.map((field) => (
                <div
                  key={field.name}
                  className="border-b border-border/70 p-4 last:border-b-0 sm:[&:nth-last-child(-n+2)]:border-b-0 sm:[&:nth-child(odd)]:border-r"
                >
                  <dt className="break-words font-mono text-[11px] text-primary">
                    {field.name}
                  </dt>
                  <dd className="mt-2 text-xs leading-5 text-muted-foreground">
                    {field.description}
                  </dd>
                </div>
              ))}
            </dl>
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

            <div className="mt-5 grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)]">
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                {EXAMPLES.map((item) => {
                  const Icon = item.icon;
                  const active = item.example === activeExample;
                  return (
                    <a
                      key={item.example}
                      href={`#${item.id}`}
                      aria-current={active ? "location" : undefined}
                      className={cn(
                        "flex min-w-0 items-start gap-3 rounded-[14px] border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35",
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
                        <span className="mt-1 block text-[10px] text-primary/85">
                          {item.effect}
                        </span>
                        <span className="mt-1 block text-[10px] leading-4 text-muted-foreground">
                          {item.description}
                        </span>
                      </span>
                    </a>
                  );
                })}
              </div>

              <div
                id={activeItem.id}
                className="h-[760px] min-w-0 scroll-mt-24 overflow-hidden rounded-[20px] border border-border/80 bg-card shadow-2xl shadow-black/20 max-sm:h-[720px]"
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
