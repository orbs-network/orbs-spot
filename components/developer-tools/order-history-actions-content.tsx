"use client";

import { useMemo } from "react";
import { Code2Icon, RefreshCwIcon } from "lucide-react";
import type { Order } from "@orbs-network/spot-react";
import { useConnection } from "wagmi";

import { Button } from "@/components/ui/button";
import { useDataChainId } from "@/lib/hooks/use-data-chain-id";
import { useBasePermitData } from "@/lib/hooks/use-base-permit-data";
import { getActiveSpotPartner } from "@/lib/partners/spot";

import {
  CANCEL_CODE_SNIPPET,
  FETCH_ORDERS_CODE_SNIPPET,
  getCancelFieldExplanation,
} from "./code-examples";
import { JsonInspectorModal, type JsonContainer } from "./json-inspector";
import { OrdersSinkGuideLink } from "./orders-sink-guide-link";

const ORDER_SINK_URL = "https://order-sink-v2.orbs.network";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export function FetchOrdersDeveloperButtonContent({
  isLoading,
  orders,
}: {
  isLoading?: boolean;
  orders: Order[];
}) {
  const { address } = useConnection();
  const chainId = useDataChainId();
  const basePermitDataQuery = useBasePermitData(chainId);
  const request = useMemo(() => {
    const query = {
      swapper: address ?? "<connected-wallet-address>",
      chainId: chainId ?? 1,
      exchange:
        basePermitDataQuery.data?.order.witness.exchange.adapter ??
        "<active-partner-adapter-address>",
    };
    const searchParams = new URLSearchParams({
      swapper: query.swapper,
      chainId: String(query.chainId),
      exchange: query.exchange,
    });

    return {
      data: {
        method: "GET",
        endpoint: `${ORDER_SINK_URL}/orders`,
        query,
      } satisfies JsonContainer,
      url: `${ORDER_SINK_URL}/orders?${searchParams.toString()}`,
    };
  }, [address, basePermitDataQuery.data, chainId]);
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

  if (!chainId) {
    return (
      <span className="text-[11px] font-medium text-muted-foreground">
        Select network to inspect
      </span>
    );
  }

  if (basePermitDataQuery.isError) {
    return (
      <Button
        data-developer-trigger
        type="button"
        variant="outline"
        size="sm"
        onClick={() => void basePermitDataQuery.refetch()}
        className="border-destructive/55 text-destructive hover:border-destructive hover:text-destructive"
        aria-label="Retry Orders Sink configuration"
      >
        <RefreshCwIcon aria-hidden="true" className="size-3.5" />
        Retry config
      </Button>
    );
  }

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
      explanation="The Request tab shows the actual HTTP GET request used by Order history. The Response tab shows the current raw RePermit orders returned for the connected wallet, chain, and active exchange."
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
          isLoading={isLoading || basePermitDataQuery.isLoading}
          className="rounded-[10px] border-primary/35 text-primary hover:border-primary/60 hover:text-primary"
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
  onCancel: () => Promise<unknown>;
  rawOrder: Order;
}) {
  const { address } = useConnection();
  const isLegacyOrder = rawOrder.version === 1;
  const partner = getActiveSpotPartner() || "external";
  const basePermitDataQuery = useBasePermitData(
    isLegacyOrder ? undefined : rawOrder.chainId,
  );
  const data = useMemo<JsonContainer>(() => {
    return {
      partner,
      abi: isLegacyOrder
        ? "function cancel(uint64 id)"
        : "function cancel(bytes32[] digests)",
      functionName: "cancel",
      address: isLegacyOrder
        ? rawOrder.twapAddress ?? ZERO_ADDRESS
        : basePermitDataQuery.data?.domain.verifyingContract ?? ZERO_ADDRESS,
      args: isLegacyOrder ? [rawOrder.id] : [[rawOrder.repermitDigest]],
      chain: rawOrder.chainId,
      account: address ?? rawOrder.maker,
    };
  }, [address, basePermitDataQuery.data, isLegacyOrder, partner, rawOrder]);

  if (!isLegacyOrder && basePermitDataQuery.isError) {
    return (
      <Button
        data-developer-trigger
        type="button"
        variant="outline"
        size="lg"
        onClick={() => void basePermitDataQuery.refetch()}
        className="h-12 rounded-[14px] border-destructive/55 text-destructive hover:border-destructive hover:text-destructive"
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
      codeSnippet={CANCEL_CODE_SNIPPET}
      description=""
      explanation="This is the populated Wagmi contract call used to cancel the selected order."
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
          isLoading={!isLegacyOrder && basePermitDataQuery.isLoading}
          className="size-12 rounded-[14px] border-primary/35 text-primary hover:border-primary/60 hover:text-primary"
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
