"use client";

import { useConnection } from "wagmi";
import { useNetworkOrders } from "./use-network-orders";

/** Linked orders reuse the wallet-wide history cache without initializing a client. */
export function useOrderPage(chainId: number, orderId: string, linkedAccount?: string, enabled = true) {
  const { address } = useConnection();
  const account = linkedAccount ?? address;
  const query = useNetworkOrders(enabled, linkedAccount);
  const order = query.data.find(order => order.historyKey === orderId && order.chainId === chainId && order.maker.toLowerCase() === account?.toLowerCase());
  return { ...query, account, order };
}
