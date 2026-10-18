"use client";

import type { Quote } from "@orbs-network/liquidity-hub-sdk";
import { FileJson2Icon } from "lucide-react";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  getLiquidityHubFieldExplanation,
  LIQUIDITY_HUB_LIVE_QUOTE_CODE_SNIPPET,
} from "./snippets/liquidity-hub-code-examples";
import { LiquidityHubGuideLink } from "./liquidity-hub-guide-link";
import {
  JsonInspectorModal,
  type JsonContainer,
} from "./json-inspector";
import { useQuoteInspectionData } from "./quote-inspection-data";

function serializeQuote(quote: Quote): JsonContainer {
  return JSON.parse(JSON.stringify(quote)) as JsonContainer;
}

export function LiquidityHubQuoteDeveloperModal({
  isLoadingQuote,
  quote,
  requestData,
  responseNotice,
}: {
  isLoadingQuote: boolean;
  quote?: Quote;
  requestData: JsonContainer;
  responseNotice?: string;
}) {
  const quoteData = useMemo(
    () => (quote ? serializeQuote(quote) : undefined),
    [quote],
  );

  return (
    <JsonInspectorModal
      codeSnippet={LIQUIDITY_HUB_LIVE_QUOTE_CODE_SNIPPET}
      data={requestData}
      description=""
      explanation="The Request tab shows the exact Liquidity Hub quote input for the current swap. The Response tab shows the complete live, wallet-bound quote returned for that request."
      getFieldExplanation={getLiquidityHubFieldExplanation}
      getResponseFieldExplanation={getLiquidityHubFieldExplanation}
      requestResponseTabs
      requiresDeveloperMode={false}
      responseData={quoteData}
      responseLabel="Liquidity Hub quote response"
      responseNotice={responseNotice}
      tabsInSectionHeader
      title="Live Liquidity Hub quote"
      triggerTooltip="Inspect the live quote request and response"
      viewModeAction={<LiquidityHubGuideLink section="fetch-quote" />}
      trigger={
        <Button
          data-developer-trigger
          data-developer-liquidity-hub-quote
          type="button"
          variant="outline"
          size="icon-sm"
          aria-busy={isLoadingQuote}
          className="relative size-8 rounded-[10px] border-primary/35 bg-primary/[0.08] text-primary shadow-[0_0_0_1px_hsl(var(--primary)/0.06),0_4px_12px_hsl(var(--primary)/0.12)] after:absolute after:-inset-1.5 after:content-[''] hover:bg-primary/[0.13] "
          aria-label="Inspect the live Liquidity Hub quote request and response"
        >
          <FileJson2Icon aria-hidden="true" className="size-4" />
        </Button>
      }
    />
  );
}

export function LiquidityHubQuoteDeveloperContent() {
  const { requestData, liveQuote, responseNotice, isLoadingQuote } = useQuoteInspectionData();

  return (
    <LiquidityHubQuoteDeveloperModal
      isLoadingQuote={isLoadingQuote}
      quote={liveQuote}
      requestData={requestData}
      responseNotice={responseNotice}
    />
  );
}
