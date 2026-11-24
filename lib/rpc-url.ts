import { getAppId } from "@/lib/partners/config";
import { getRpcGateway, getRpcUrls } from "@/lib/rpc-config";

export class RpcConfigurationError extends Error {}

export function getRpcUrl(chainId: number | string) {
  const endpoint = getRpcUrls()?.[String(chainId)];
  if (endpoint) return endpoint;
  const rpcUrl = getRpcGateway();
  if (!rpcUrl) throw new RpcConfigurationError("RPC is not configured for this network");
  const url = new URL(rpcUrl);
  url.searchParams.set("chainId", String(chainId));
  url.searchParams.set("appId", getAppId());
  return url.toString();
}

// Verify the upstream chain before using it for wallet-related reads. Deduplicate
// concurrent checks and revalidate periodically; never expose the endpoint URL.
const checks = new Map<string, { expires: number; promise: Promise<void> }>();
export async function assertRpcChain(chainId: number): Promise<void> {
  const endpoint = getRpcUrl(chainId);
  const key = `${chainId}:${endpoint}`;
  const existing = checks.get(key);
  if (existing && existing.expires > Date.now()) return existing.promise;
  const promise = (async () => {
    const response = await fetch(endpoint, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }),
      signal: AbortSignal.timeout(10_000), cache: "no-store",
    });
    if (!response.ok) throw new RpcConfigurationError("RPC network verification failed");
    const data: unknown = await response.json();
    if (!data || typeof data !== "object" || !("result" in data) || typeof data.result !== "string"
      || !/^0x[\da-f]+$/i.test(data.result) || BigInt(data.result) !== BigInt(chainId)) {
      throw new RpcConfigurationError("RPC endpoint returned the wrong network");
    }
  })();
  checks.set(key, { expires: Date.now() + 60_000, promise });
  try { await promise; } catch (error) {
    if (checks.get(key)?.promise === promise) checks.delete(key);
    throw error;
  }
}
