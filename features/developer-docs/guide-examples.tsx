"use client";

import { Code2Icon } from "lucide-react";

import {
  CANCEL_EXAMPLE_CODE_SNIPPET,
  CANCEL_EXAMPLE_DATA,
  FETCH_ORDERS_CODE_SNIPPET,
  FETCH_ORDERS_EXAMPLE_DATA,
  FETCH_ORDERS_EXAMPLE_RESPONSE_DATA,
  FETCH_ORDERS_EXAMPLE_URL,
  FULL_ORDER_FLOW_CODE_SNIPPET,
  PERMIT_DATA_CODE_SNIPPET,
  PERMIT_DATA_REQUEST_DATA,
  PERMIT_DATA_REQUEST_URL,
  PERMIT_DATA_RESPONSE,
  SIGNATURE_EXAMPLE_DATA,
} from "@/components/developer-tools/code-examples";
import {
  LIQUIDITY_HUB_EXAMPLE_DATA,
  LIQUIDITY_HUB_FULL_FLOW_CODE_SNIPPET,
  LIQUIDITY_HUB_LIVE_QUOTE_CODE_SNIPPET,
  LIQUIDITY_HUB_QUOTE_EXAMPLE_RESPONSE_DATA,
} from "@/components/developer-tools/liquidity-hub-code-examples";
import { LiquidityHubFlow } from "@/components/developer-tools/liquidity-hub-flow";
import {
  JsonInspectorPanel,
  type JsonContainer,
} from "@/components/developer-tools/json-inspector";
import { cn } from "@/lib/utils";
import {
  ADVANCED_ORDERS_PROVIDER_CODE_SNIPPET,
  ADVANCED_ORDERS_PROVIDER_EXAMPLE_DATA,
} from "./advanced-orders-provider-example";
import type { DeveloperGuideId } from "./guide-types";

const LIQUIDITY_HUB_FLOW_DATA: JsonContainer = {
  ...LIQUIDITY_HUB_EXAMPLE_DATA,
  quote: LIQUIDITY_HUB_QUOTE_EXAMPLE_RESPONSE_DATA,
  execution: {
    signature: "<wallet-signature>",
  },
};

function ExampleFrame({
  children,
  frameClassName,
  label,
}: {
  children: React.ReactNode;
  frameClassName?: string;
  label: string;
}) {
  return (
    <section className="min-w-0" aria-label={label}>
      <div className="mb-3 flex items-center gap-2">
        <Code2Icon aria-hidden="true" className="size-4 text-primary" />
        <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </h3>
      </div>
      <div
        className={cn(
          "h-[760px] max-h-[760px] min-w-0 overflow-hidden rounded-2xl border border-border/80 bg-card shadow-2xl shadow-black/20 max-sm:h-[680px] max-sm:max-h-[680px]",
          frameClassName,
        )}
      >
        {children}
      </div>
    </section>
  );
}

export function InteractiveGuideExample({
  guideId,
  stepId,
}: {
  guideId: DeveloperGuideId;
  stepId: string;
}) {
  if (guideId === "liquidity-hub" && stepId === "request-quotes") {
    return (
      <ExampleFrame label="Optional Wagmi v3 reference">
        <JsonInspectorPanel
          data={LIQUIDITY_HUB_EXAMPLE_DATA}
          density="documentation"
          codeSnippet={LIQUIDITY_HUB_LIVE_QUOTE_CODE_SNIPPET}
          description=""
          explanation="The Request tab contains the quote arguments used by Dev Mode. The Response tab contains the complete wallet-bound quote used for execution."
          explanationDisplay="tooltip"
          requestResponseTabs
          responseData={LIQUIDITY_HUB_QUOTE_EXAMPLE_RESPONSE_DATA}
          responseLabel="Liquidity Hub quote response"
          tabsInSectionHeader
          title="Fetch a Liquidity Hub Quote"
        />
      </ExampleFrame>
    );
  }

  if (guideId === "liquidity-hub" && stepId === "execute-the-full-flow") {
    return (
      <div className="space-y-7">
        <ExampleFrame
          label="Optional Wagmi v3 reference"
          frameClassName="h-[min(960px,88dvh)] max-h-[960px] min-h-[760px] max-sm:h-[720px] max-sm:max-h-[720px] max-sm:min-h-0"
        >
          <JsonInspectorPanel
            data={LIQUIDITY_HUB_FLOW_DATA}
            density="documentation"
            codeSnippet={LIQUIDITY_HUB_FULL_FLOW_CODE_SNIPPET}
            description=""
            explanation="Start after Liquidity Hub wins, prepare funds, refresh its wallet-bound quote, then sign, submit, and confirm that exact quote. This flow never submits a DEX transaction."
            explanationDisplay="tooltip"
            title="Liquidity Hub Full Live Flow"
          />
        </ExampleFrame>
        <LiquidityHubFlow />
      </div>
    );
  }

  if (guideId === "advanced-orders-core" && stepId === "create-order") {
    return (
      <ExampleFrame
        label="Optional Wagmi v3 reference"
        frameClassName="h-[min(960px,88dvh)] max-h-[960px] min-h-[760px] max-sm:h-[720px] max-sm:max-h-[720px] max-sm:min-h-0"
      >
        <JsonInspectorPanel
          data={SIGNATURE_EXAMPLE_DATA}
          density="documentation"
          codeSnippet={FULL_ORDER_FLOW_CODE_SNIPPET}
          description=""
          explanation="The main file reads current values from the host hooks, switches native input to the active chain's WToken after wrapping, builds signTypedDataArgs inline, signs it, and submits its exact message."
          explanationDisplay="tooltip"
          title="Create an Order End-to-End"
        />
      </ExampleFrame>
    );
  }

  if (
    guideId === "advanced-orders-core" &&
    stepId === "protocol-reference"
  ) {
    return (
      <ExampleFrame label="Interactive HTTP reference">
        <JsonInspectorPanel
          data={PERMIT_DATA_REQUEST_DATA}
          density="documentation"
          codeSnippet={PERMIT_DATA_CODE_SNIPPET}
          curl={{
            headers: { Accept: "application/json" },
            method: "GET",
            url: PERMIT_DATA_REQUEST_URL,
          }}
          description=""
          explanation="Request the server-controlled EIP-712 template for one partner and chain. The response tab shows the complete language-independent schema."
          explanationDisplay="tooltip"
          requestResponseTabs
          responseData={PERMIT_DATA_RESPONSE}
          responseInitiallyCollapsed={false}
          responseLabel="Permit data response"
          tabsInSectionHeader
          title="Fetch RePermit Data"
        />
      </ExampleFrame>
    );
  }

  if (
    guideId === "advanced-orders-react" &&
    stepId === "advanced-orders-provider"
  ) {
    return (
      <ExampleFrame
        label="Interactive React package reference"
        frameClassName="h-[min(900px,84dvh)] max-h-[900px] min-h-[640px] max-sm:h-[min(760px,78dvh)] max-sm:max-h-[760px] max-sm:min-h-[560px]"
      >
        <JsonInspectorPanel
          data={ADVANCED_ORDERS_PROVIDER_EXAMPLE_DATA}
          density="documentation"
          codeSnippet={ADVANCED_ORDERS_PROVIDER_CODE_SNIPPET}
          description=""
          explanation="Connect existing DEX state to the Advanced Orders provider. Comments in the snippet and the field reference below explain each value."
          explanationDisplay="tooltip"
          title="Advanced Orders Provider"
        />
      </ExampleFrame>
    );
  }

  if (
    guideId === "advanced-orders-core" &&
    stepId === "fetch-order-sink-orders"
  ) {
    return (
      <ExampleFrame label="Interactive HTTP reference">
        <JsonInspectorPanel
          data={FETCH_ORDERS_EXAMPLE_DATA}
          density="documentation"
          codeSnippet={FETCH_ORDERS_CODE_SNIPPET}
          curl={{
            headers: { Accept: "application/json" },
            method: "GET",
            url: FETCH_ORDERS_EXAMPLE_URL,
          }}
          description=""
          explanation="Fetch orders for the connected wallet and chain. The exchange address comes from the trusted base configuration."
          explanationDisplay="tooltip"
          requestResponseTabs
          responseData={FETCH_ORDERS_EXAMPLE_RESPONSE_DATA}
          responseInitiallyCollapsed={false}
          responseLabel="Orders JSON response"
          tabsInSectionHeader
          title="Fetch Order History Request"
        />
      </ExampleFrame>
    );
  }

  if (
    guideId === "advanced-orders-core" &&
    stepId === "cancel-order-sink-orders"
  ) {
    return (
      <ExampleFrame label="Optional Wagmi v3 reference">
        <JsonInspectorPanel
          data={CANCEL_EXAMPLE_DATA}
          density="documentation"
          codeSnippet={CANCEL_EXAMPLE_CODE_SNIPPET}
          description=""
          explanation="Cancel a RePermit order on-chain using order.metadata.repermitDigest, then wait for the transaction receipt."
          explanationDisplay="tooltip"
          title="Cancel Order Example"
        />
      </ExampleFrame>
    );
  }

  return null;
}
