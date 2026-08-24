"use client";

import { useMemo } from "react";
import { Code2Icon } from "lucide-react";
import { getConfig, type Order } from "@orbs-network/spot-react";
import { useConnection } from "wagmi";

import { Button } from "@/components/ui/button";
import { useDataChainId } from "@/lib/hooks/use-data-chain-id";
import { getActiveSpotPartner } from "@/lib/partners/spot";

import {
  CANCEL_CODE_SNIPPET,
  FETCH_ORDERS_CODE_SNIPPET,
  getCancelFieldExplanation,
  getFetchOrdersResponseFieldExplanation,
  isCancelValueEditable,
} from "./code-examples";
import { JsonInspectorModal, type JsonContainer } from "./json-inspector";

const ORDER_SINK_URL = "https://order-sink-v2.orbs.network";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

function getFetchOrdersConfig(chainId?: number) {
  const fallback = {
    chainId: chainId ?? 1,
    exchange: "<active-partner-adapter-address>",
  };

  if (!chainId) return fallback;

  try {
    const config = getConfig(getActiveSpotPartner(), chainId);
    return {
      chainId: config.twapConfig?.chainId ?? chainId,
      exchange: config.adapter,
    };
  } catch {
    return fallback;
  }
}

function getCancelContractAddress(order: Order) {
  if (order.version === 1) return order.twapAddress ?? ZERO_ADDRESS;

  try {
    return getConfig(getActiveSpotPartner(), order.chainId).repermit;
  } catch {
    return ZERO_ADDRESS;
  }
}

export function FetchOrdersDeveloperButtonContent({
  orders,
}: {
  orders: Order[];
}) {
  const { address } = useConnection();
  const chainId = useDataChainId();
  const request = useMemo(() => {
    const config = getFetchOrdersConfig(chainId);
    const query = {
      swapper: address ?? "<connected-wallet-address>",
      chainId: config.chainId,
      exchange: config.exchange,
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
  }, [address, chainId]);
  const responseData = useMemo(
    () =>
      JSON.parse(
        JSON.stringify({
          orders: orders
            .filter((order) => order.version === 2)
            .map((order) => order.rawOrder),
        }),
      ) as JsonContainer,
    [orders],
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
      explanation="The Request tab shows the actual HTTP GET request used by Order history. The Response tab shows the current raw RePermit orders returned for the connected wallet, chain, and active exchange."
      getResponseFieldExplanation={getFetchOrdersResponseFieldExplanation}
      requestResponseTabs
      requiresDeveloperMode={false}
      responseData={responseData}
      responseInitiallyCollapsed
      responseLabel="Orders JSON response"
      tabsInSectionHeader
      title="Fetch orders request"
      triggerTooltip="View fetch orders request"
      trigger={
        <Button
          data-developer-trigger
          type="button"
          variant="outline"
          size="icon-sm"
          className="rounded-[10px] border-primary/35 text-primary hover:border-primary/60 hover:text-primary"
          aria-label="Show how to fetch orders"
        >
          <Code2Icon className="size-4" />
        </Button>
      }
    />
  );
}

export function CancelOrderDeveloperButtonContent({
  rawOrder,
  title,
}: {
  rawOrder: Order;
  title: string;
}) {
  const { address } = useConnection();
  const data = useMemo<JsonContainer>(() => {
    const isLegacyOrder = rawOrder.version === 1;

    return {
      abi: isLegacyOrder
        ? "function cancel(uint64 id)"
        : "function cancel(bytes32[] digests)",
      functionName: "cancel",
      address: getCancelContractAddress(rawOrder),
      args: isLegacyOrder ? [rawOrder.id] : [[rawOrder.repermitDigest]],
      chain: rawOrder.chainId,
      account: address ?? rawOrder.maker,
    };
  }, [address, rawOrder]);

  return (
    <JsonInspectorModal
      data={data}
      editable
      codeSnippet={CANCEL_CODE_SNIPPET}
      description=""
      explanation="This is the populated Wagmi contract call used to cancel the selected order. Legacy orders cancel by numeric order ID, while RePermit orders cancel by signed-order digest."
      getFieldExplanation={getCancelFieldExplanation}
      isValueEditable={isCancelValueEditable}
      requiresDeveloperMode={false}
      title={`${title} cancel code`}
      triggerTooltip="View cancel order code"
      trigger={
        <Button
          data-developer-trigger
          type="button"
          variant="outline"
          size="icon-lg"
          className="size-12 rounded-[14px] border-primary/35 text-primary hover:border-primary/60 hover:text-primary"
          aria-label="Open cancel order code"
        >
          <Code2Icon className="size-5" />
        </Button>
      }
    />
  );
}
