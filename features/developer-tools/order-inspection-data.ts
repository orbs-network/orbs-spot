"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useConnection } from "wagmi";
import type { Order } from "@orbs-network/spot-ui";
import { useSpotPartner } from "@/lib/hooks/use-spot-partner";
import { spotClientQueryOptions } from "@/lib/spot/queries";
import type { JsonContainer } from "./json-inspector";

export function useFetchOrdersInspectionData(orders: Order[]) {
  const { address } = useConnection();
  const { partner: exchange } = useSpotPartner();
  const request = useMemo(() => {
    const query = { swapper: address ?? "<connected-wallet-address>", exchange };
    const endpoint = "https://order-sink-v2.orbs.network/orders";
    return { data: { method: "GET", endpoint, partner: exchange, query } satisfies JsonContainer,
      url: `${endpoint}?${new URLSearchParams(query)}` };
  }, [address, exchange]);
  const responseData = useMemo(() => JSON.parse(JSON.stringify({ orders: orders.filter(order => order.version === 2).map(order => order.rawOrder) })) as JsonContainer, [orders]);
  return { request, responseData, hasOrders: orders.some(order => order.version === 2) };
}

export function useCancelOrderInspectionData(rawOrder: Order, enabled: boolean) {
  const { partner } = useSpotPartner();
  const { address } = useConnection();
  const client = useQuery({ ...spotClientQueryOptions(partner, rawOrder.chainId, true), enabled });
  const data = useMemo<JsonContainer>(() => {
    const request = client.data?.getCancelOrderRequest(rawOrder);
    return { partner: client.data?.partner ?? partner,
      abi: JSON.parse(JSON.stringify(request?.abi ?? [])) as JsonContainer,
      functionName: "cancel", address: request?.contractAddress ?? "", args: request?.args ?? [],
      chain: rawOrder.chainId, account: address ?? rawOrder.maker };
  }, [address, client.data, rawOrder, partner]);
  return { client, data };
}
