"use client";

import { Code2Icon, DatabaseIcon, HistoryIcon } from "lucide-react";

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
import {
  IntegrationGuideLayout,
  type IntegrationGuideExample,
} from "./integration-guide-layout";
import { JsonInspectorPanel } from "./json-inspector";

const IMPLEMENTATION_RULES = [
  "Native input is not supported. When native currency is selected, wrap it first and use the WToken address for permitted.token and witness.input.token.",
  "Build the order once; sign and submit that exact object.",
  "Use basePermitData.domain.verifyingContract as the approval spender.",
  "Wallet, domain, and order chain IDs must match.",
  "Use token base units, Unix seconds, and basis points.",
] as const;

const EXAMPLES = [
  {
    description: "One implementation file with reusable types kept separate.",
    effect: "Flow + types",
    icon: Code2Icon,
    id: "end-to-end",
    title: "Create an Order End-to-End",
  },
  {
    description: "Query orders for a wallet, chain, and exchange.",
    effect: "HTTP GET",
    icon: DatabaseIcon,
    id: "fetch-orders",
    title: "Fetch Order History",
  },
  {
    description: "Cancel a RePermit order using its digest.",
    effect: "On-chain transaction",
    icon: HistoryIcon,
    id: "cancel-order",
    title: "Cancel an Order",
  },
] as const satisfies readonly IntegrationGuideExample[];

function renderExample(exampleId: string) {
  if (exampleId === "end-to-end") {
    return (
      <JsonInspectorPanel
        data={SIGNATURE_EXAMPLE_DATA}
        density="documentation"
        codeSnippet={FULL_ORDER_FLOW_CODE_SNIPPET}
        description=""
        explanation="The canonical flow: fetch trusted configuration, build one order, prepare funds, sign it, and submit the exact same object to Orders Sink. Replace the sample amounts, nonces, and timestamps with values from your application."
        explanationDisplay="tooltip"
        getFieldExplanation={getSignatureFieldExplanation}
        title="Create an Order End-to-End"
      />
    );
  }

  if (exampleId === "cancel-order") {
    return (
      <JsonInspectorPanel
        data={CANCEL_EXAMPLE_DATA}
        density="documentation"
        codeSnippet={CANCEL_EXAMPLE_CODE_SNIPPET}
        description=""
        explanation="Cancel a RePermit order on-chain using order.metadata.repermitDigest, then wait for the transaction receipt."
        explanationDisplay="tooltip"
        title="Cancel Order Example"
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
      explanationDisplay="tooltip"
      getResponseFieldExplanation={getFetchOrdersResponseFieldExplanation}
      requestResponseTabs
      responseData={FETCH_ORDERS_EXAMPLE_RESPONSE_DATA}
      responseLabel="Orders JSON response"
      tabsInSectionHeader
      title="Fetch Order History Request"
    />
  );
}

export function OrdersSinkGuide() {
  return (
    <IntegrationGuideLayout
      eyebrow="Advanced Order Docs"
      title="Create Advanced Orders"
      description="A complete implementation reference for configuration, token preparation, EIP-712 signing, submission, order history, and cancellation. Use Dev Mode in the trading interface to inspect the same flow with your current form and wallet data."
      implementationSummary="Fetch trusted configuration, build one order, prepare and approve its input token, sign it, then submit the exact signed object."
      rules={IMPLEMENTATION_RULES}
      examples={EXAMPLES}
      renderExample={renderExample}
    />
  );
}
