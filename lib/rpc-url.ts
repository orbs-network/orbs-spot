import { getAppId } from "@/lib/partners/config";

export function getRpcUrl(chainId: number | string) {
  const rpcUrl = process.env.RPC_URL;

  if (!rpcUrl) {
    throw new Error("RPC_URL is not configured");
  }

  const url = new URL(rpcUrl);
  url.searchParams.set("chainId", String(chainId));
  url.searchParams.set("appId", getAppId());

  return url.toString();
}
