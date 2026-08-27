"use client";

import { Code2Icon, RefreshCwIcon } from "lucide-react";

import {
  getLiquidityHubFieldExplanation,
  LIQUIDITY_HUB_EXAMPLE_DATA,
  LIQUIDITY_HUB_FULL_FLOW_CODE_SNIPPET,
  LIQUIDITY_HUB_LIVE_QUOTE_CODE_SNIPPET,
  LIQUIDITY_HUB_QUOTE_EXAMPLE_RESPONSE_DATA,
} from "./liquidity-hub-code-examples";
import {
  IntegrationGuideLayout,
  type IntegrationGuideExample,
} from "./integration-guide-layout";
import { JsonInspectorPanel, type JsonContainer } from "./json-inspector";
import { LiquidityHubFlow } from "./liquidity-hub-flow";

const IMPLEMENTATION_RULES = [
  "Enable the live execution flow only after a Liquidity Hub quote response exists, and preserve that exact response as quotePayload.",
  'Construct the SDK with the active chain and the DEX partner ID provided by Orbs. Use "unknown" when no partner ID was assigned.',
  "Use ERC-20 token addresses and total input amount in base units. When the selected input is native, quote its wrapped-token address.",
  "Let getLatestQuote() return the current response when isFreshQuote() passes or fetch and cache a replacement when it is stale. Call it again immediately before signing.",
  "Check the input token allowance for Permit2 and approve only when the existing allowance is below quote.inAmount.",
  "Liquidity Hub does not support native inToken. Wrap quote.inAmount into quote.inToken and wait for its receipt before continuing.",
  "Treat permitData as opaque SDK data and sign the unchanged quote returned by getLatestQuote() with the quote wallet.",
  "Submit the same quote and signature to liquidityHub.swap(), wait for the transaction receipt, and return only that receipt.",
] as const;

const FLOW_EXAMPLE_DATA: JsonContainer = {
  ...LIQUIDITY_HUB_EXAMPLE_DATA,
  quote: LIQUIDITY_HUB_QUOTE_EXAMPLE_RESPONSE_DATA,
  execution: {
    signature: "<wallet-signature>",
  },
};

const EXAMPLES = [
  {
    description:
      "Prepare, sign, swap, and confirm the exact live quote in one complete flow.",
    effect: "Flow + receipt",
    icon: Code2Icon,
    id: "execute-swap",
    title: "Full Live Flow",
  },
  {
    description: "Inspect the same quote request and response shown in Dev Mode.",
    effect: "Request + response",
    icon: RefreshCwIcon,
    id: "fetch-quote",
    title: "Live Quote",
  },
] as const satisfies readonly IntegrationGuideExample[];

function renderExample(exampleId: string) {
  if (exampleId === "execute-swap") {
    return (
      <JsonInspectorPanel
        data={FLOW_EXAMPLE_DATA}
        density="documentation"
        codeSnippet={LIQUIDITY_HUB_FULL_FLOW_CODE_SNIPPET}
        description=""
        explanation="The same end-to-end implementation shown by the live flow: load the existing quote response, check allowance, optionally wrap and approve, call getLatestQuote() again before signing, then submit that freshness-checked quote and wait for the receipt."
        explanationDisplay="tooltip"
        getFieldExplanation={getLiquidityHubFieldExplanation}
        title="Liquidity Hub Full Live Flow"
      />
    );
  }

  return (
    <JsonInspectorPanel
      data={LIQUIDITY_HUB_EXAMPLE_DATA}
      density="documentation"
      codeSnippet={LIQUIDITY_HUB_LIVE_QUOTE_CODE_SNIPPET}
      description=""
      explanation="The Request tab contains the exact quote arguments used by the live Dev Mode example. The Response tab contains the complete wallet-bound quote that becomes quotePayload for execution."
      explanationDisplay="tooltip"
      getFieldExplanation={getLiquidityHubFieldExplanation}
      getResponseFieldExplanation={getLiquidityHubFieldExplanation}
      requestResponseTabs
      responseData={LIQUIDITY_HUB_QUOTE_EXAMPLE_RESPONSE_DATA}
      responseLabel="Liquidity Hub quote response"
      tabsInSectionHeader
      title="Fetch a Liquidity Hub Quote"
    />
  );
}

export function LiquidityHubGuide() {
  return (
    <IntegrationGuideLayout
      title="Integrate Orbs Liquidity Hub"
      description="A complete React integration reference for requesting a Liquidity Hub quote, preparing its input token, authorizing Permit2, checking freshness immediately before signing, submitting that exact quote, and waiting for its receipt. Dev Mode in the Swap tab populates these same snippets with the current form, quote, and wallet data."
      implementationSummary="Start from the exact live quote response, let getLatestQuote() replace it only when the SDK considers it stale, then keep the returned quote unchanged through signature and submission."
      rules={IMPLEMENTATION_RULES}
      examples={EXAMPLES}
      renderExample={renderExample}
    >
      <LiquidityHubFlow />
    </IntegrationGuideLayout>
  );
}
