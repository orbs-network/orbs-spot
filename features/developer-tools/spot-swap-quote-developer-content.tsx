"use client";

import type { SwapQuote } from "@orbs-network/spot-ui";
import { FileJson2Icon } from "lucide-react";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  getSpotSwapFieldExplanation,
  SPOT_SWAP_LIVE_QUOTE_CODE_SNIPPET,
} from "./snippets/spot-swap-code-examples";
import { SpotSwapGuideLink } from "./spot-swap-guide-link";
import {
  JsonInspectorModal,
  type JsonContainer,
} from "./json-inspector";
import { useQuoteInspectionData } from "./quote-inspection-data";

function serializeQuote(quote: SwapQuote): JsonContainer {
  return JSON.parse(JSON.stringify(quote)) as JsonContainer;
}

export function SpotSwapQuoteDeveloperModal({
  isLoadingQuote,
  quote,
  requestData,
  responseNotice,
}: {
  isLoadingQuote: boolean;
  quote?: SwapQuote;
  requestData: JsonContainer;
  responseNotice?: string;
}) {
  const quoteData = useMemo(
    () => (quote ? serializeQuote(quote) : undefined),
    [quote],
  );

  return (
    <JsonInspectorModal
      codeSnippet={SPOT_SWAP_LIVE_QUOTE_CODE_SNIPPET}
      data={requestData}
      description=""
      explanation="The Request tab shows the exact Spot quote input for the current swap. The Response tab shows the complete live quote and its frozen request identity returned for that request."
      getFieldExplanation={getSpotSwapFieldExplanation}
      getResponseFieldExplanation={getSpotSwapFieldExplanation}
      requestResponseTabs
      requiresDeveloperMode={false}
      responseData={quoteData}
      responseLabel="Spot quote response"
      responseNotice={responseNotice}
      tabsInSectionHeader
      title="Live Spot quote"
      triggerTooltip="Inspect the live quote request and response"
      viewModeAction={<SpotSwapGuideLink section="fetch-quote" />}
      trigger={
        <Button
          data-developer-trigger
          data-developer-spot-swap-quote
          type="button"
          variant="outline"
          size="icon-sm"
          aria-busy={isLoadingQuote}
          className="relative size-8 rounded-[10px] border-primary/35 bg-primary/[0.08] text-primary shadow-[0_0_0_1px_hsl(var(--primary)/0.06),0_4px_12px_hsl(var(--primary)/0.12)] after:absolute after:-inset-1.5 after:content-[''] hover:bg-primary/[0.13] "
          aria-label="Inspect the live Spot quote request and response"
        >
          <FileJson2Icon aria-hidden="true" className="size-4" />
        </Button>
      }
    />
  );
}

export function SpotSwapQuoteDeveloperContent() {
  const { requestData, liveQuote, responseNotice, isLoadingQuote } = useQuoteInspectionData();

  return (
    <SpotSwapQuoteDeveloperModal
      isLoadingQuote={isLoadingQuote}
      quote={liveQuote}
      requestData={requestData}
      responseNotice={responseNotice}
    />
  );
}
