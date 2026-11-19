"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useConnection } from "wagmi";
import type { Order } from "@orbs-network/spot-ui";
import { useSpotPartner } from "@/lib/hooks/use-spot-partner";
import { spotClientQueryOptions } from "@/lib/spot/queries";
import { useSpotApiUrl } from "@/lib/hooks/use-spot-api-url";
import type { JsonContainer } from "./json-inspector";

export function useFetchOrdersInspectionData(orders: Order[]) {
  const { address } = useConnection();
  const { partner: exchange } = useSpotPartner();
  const apiUrl = useSpotApiUrl();
  const request = useMemo(() => {
    const query = { swapper: address ?? "<connected-wallet-address>", exchange };
    const endpoint = `${apiUrl}/orders`;
    return { data: { method: "GET", endpoint, apiUrl, partner: exchange, query } satisfies JsonContainer,
      url: `${endpoint}?${new URLSearchParams(query)}` };
  }, [address, exchange, apiUrl]);
  const responseData = useMemo(() => JSON.parse(JSON.stringify({ orders: orders.filter(order => order.version === 2).map(order => order.rawOrder) })) as JsonContainer, [orders]);
  return { request, responseData, hasOrders: orders.some(order => order.version === 2) };
}

export function useCancelOrderInspectionData(rawOrder: Order, enabled: boolean) {
  const { partner } = useSpotPartner();
  const { address } = useConnection();
  const apiUrl = useSpotApiUrl();
  const client = useQuery({ ...spotClientQueryOptions(partner, rawOrder.chainId, true, apiUrl), enabled });
  const data = useMemo<JsonContainer>(() => {
    const request = client.data?.getCancelOrderRequest(rawOrder);
    return { partner: client.data?.partner ?? partner, apiUrl,
      abi: JSON.parse(JSON.stringify(request?.abi ?? [])) as JsonContainer,
      functionName: "cancel", address: request?.contractAddress ?? "", args: request?.args ?? [],
      chain: rawOrder.chainId, account: address ?? rawOrder.maker };
  }, [address, client.data, rawOrder, partner, apiUrl]);
  return { client, data };
}
