import type { Order } from "@orbs-network/spot-ui";
import { DEFAULT_SPOT_API_URL, DEV_SPOT_API_URL, PROD_V1_SPOT_API_URL } from "./api";

/** Include the network and maker so bookmarks also work without a connected wallet. */
export function getOrderHref(order: Pick<Order, "chainId" | "historyKey" | "maker">, apiUrl = DEFAULT_SPOT_API_URL): string {
  const apiFlag = apiUrl === DEV_SPOT_API_URL ? "&api=dev" : apiUrl === PROD_V1_SPOT_API_URL ? "&api=v1" : "";
  return `/orders?order=${encodeURIComponent(order.historyKey)}&orderChainId=${order.chainId}&account=${encodeURIComponent(order.maker.toLowerCase())}${apiFlag}`;
}
