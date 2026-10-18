"use client";

import { useState } from "react";
import { Code2Icon, RefreshCwIcon } from "lucide-react";
import type { Order } from "@orbs-network/spot-ui";
import { Button } from "@/components/ui/button";
import {
  CANCEL_CODE_SNIPPET,
  FETCH_ORDERS_CODE_SNIPPET,
  getCancelFieldExplanation,
} from "./snippets/code-examples";
import { JsonInspectorModal } from "./json-inspector";
import { OrdersSinkGuideLink } from "./orders-sink-guide-link";
import { useCancelOrderInspectionData, useFetchOrdersInspectionData } from "./order-inspection-data";

export function FetchOrdersDeveloperButtonContent({
  isLoading,
  orders,
}: {
  isLoading?: boolean;
  orders: Order[];
}) {
  const { request, responseData, hasOrders } = useFetchOrdersInspectionData(orders);

  return (
    <JsonInspectorModal
      data={request.data}
      codeSnippet={FETCH_ORDERS_CODE_SNIPPET}
      curl={{
        method: "GET",
        url: request.url,
        headers: { Accept: "application/json" },
      }}
      description=""
      explanation="The Request tab shows the HTTP GET request used by order history across all networks for the connected wallet and exchange. The Response tab shows the raw RePermit records for the displayed orders. The SDK snippet returns normalized v2 orders without loading configuration."
      requestResponseTabs
      requiresDeveloperMode={false}
      responseData={responseData}
      responseInitiallyCollapsed
      responseLabel="Orders JSON response"
      responseNotice={
        !isLoading && !hasOrders
          ? "Create an order to inspect developer data"
          : undefined
      }
      tabsInSectionHeader
      title="Fetch orders request"
      viewModeAction={<OrdersSinkGuideLink section="fetch-orders" />}
      triggerTooltip="View fetch orders request"
      trigger={
        <Button
          data-developer-trigger
          type="button"
          variant="outline"
          size="icon-sm"
          isLoading={isLoading}
          className="rounded-[10px] border-primary/35 text-primary "
          aria-label="Show how to fetch orders"
        >
          <Code2Icon aria-hidden="true" className="size-4" />
        </Button>
      }
    />
  );
}

export function CancelOrderDeveloperButtonContent({
  isCancelling,
  onCancel,
  rawOrder,
}: {
  isCancelling: boolean;
  onCancel: () => void;
  rawOrder: Order;
}) {
  const [inspected, setInspected] = useState(false);
  const { client, data } = useCancelOrderInspectionData(rawOrder, inspected);

  if (client.isError) {
    return (
      <Button
        data-developer-trigger
        type="button"
        variant="outline"
        size="lg"
        onClick={() => void client.refetch()}
        className="h-12 rounded-[14px] border-destructive/55 text-destructive "
        aria-label="Retry Orders Sink configuration"
      >
        <RefreshCwIcon aria-hidden="true" className="size-4" />
        Retry config
      </Button>
    );
  }

  return (
    <JsonInspectorModal
      data={data}
      onOpenChange={open => { if (open) setInspected(true); }}
      codeSnippet={CANCEL_CODE_SNIPPET}
      description=""
      explanation="The SDK selects the cancellation contract, ABI and arguments for this order. The TypeScript example sends the request, waits for confirmation and refreshes history."
      explanationDisplay="tooltip"
      getFieldExplanation={getCancelFieldExplanation}
      requiresDeveloperMode={false}
      title="Cancel order code"
      triggerTooltip="View cancel order code"
      trigger={
        <Button
          data-developer-trigger
          type="button"
          variant="outline"
          size="icon-lg"
          isLoading={client.isLoading}
          className="size-12 rounded-[14px] border-primary/35 text-primary "
          aria-label="Open cancel order code"
        >
          <Code2Icon aria-hidden="true" className="size-5" />
        </Button>
      }
      viewModeAction={
        <div className="flex w-full items-center justify-between gap-2">
          <OrdersSinkGuideLink section="cancel-order" />
          <Button
            data-submit-button
            type="button"
            onClick={() => void onCancel()}
            isLoading={isCancelling}
            disabled={isCancelling}
            className="min-w-36"
          >
            Cancel order
          </Button>
        </div>
      }
    />
  );
}
