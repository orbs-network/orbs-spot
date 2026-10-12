"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Code2Icon, RefreshCwIcon } from "lucide-react";
import type { Order } from "@orbs-network/spot-ui";
import { useConnection } from "wagmi";

import { Button } from "@/components/ui/button";
import { spotClientQueryOptions } from "@/lib/spot/queries";
import { getActiveSpotPartner } from "@/lib/partners/spot";

import {
  CANCEL_CODE_SNIPPET,
  FETCH_ORDERS_CODE_SNIPPET,
  getCancelFieldExplanation,
} from "./snippets/code-examples";
import { JsonInspectorModal, type JsonContainer } from "./json-inspector";
import { OrdersSinkGuideLink } from "./orders-sink-guide-link";

const ORDER_SINK_URL = "https://order-sink-v2.orbs.network";

export function FetchOrdersDeveloperButtonContent({
  isLoading,
  orders,
}: {
  isLoading?: boolean;
  orders: Order[];
}) {
  const { address } = useConnection();
  const exchange = getActiveSpotPartner() || "external";
  const request = useMemo(() => {
    const query = {
      swapper: address ?? "<connected-wallet-address>",
      exchange,
    };
    const searchParams = new URLSearchParams({
      swapper: query.swapper,
      exchange: query.exchange,
    });

    return {
      data: {
        method: "GET",
        endpoint: `${ORDER_SINK_URL}/orders`,
        partner: exchange,
        query,
      } satisfies JsonContainer,
      url: `${ORDER_SINK_URL}/orders?${searchParams.toString()}`,
    };
  }, [address, exchange]);
  const rePermitOrders = useMemo(
    () =>
      orders
        .filter((order) => order.version === 2)
        .map((order) => order.rawOrder),
    [orders],
  );
  const responseData = useMemo(
    () =>
      JSON.parse(
        JSON.stringify({ orders: rePermitOrders }),
      ) as JsonContainer,
    [rePermitOrders],
  );

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
        !isLoading && rePermitOrders.length === 0
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
  const { address } = useConnection();
  const [inspected, setInspected] = useState(false);
  const client = useQuery({
    ...spotClientQueryOptions(getActiveSpotPartner(), rawOrder.chainId, true),
    enabled: inspected,
  });
  const data = useMemo<JsonContainer>(() => {
    const request = client.data?.getCancelOrderRequest(rawOrder);
    return {
      partner: client.data?.partner ?? getActiveSpotPartner(),
      abi: JSON.parse(JSON.stringify(request?.abi ?? [])) as JsonContainer,
      functionName: "cancel",
      address: request?.contractAddress ?? "",
      args: request?.args ?? [],
      chain: rawOrder.chainId,
      account: address ?? rawOrder.maker,
    };
  }, [address, client.data, rawOrder]);

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
