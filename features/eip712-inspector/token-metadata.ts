import {
  createPublicClient,
  erc20Abi,
  hexToString,
  http,
  type Address,
  type Chain,
} from "viem";
import type { TokenInfo } from "./inspect";

/** Reads use the same server-side RPC configuration as the rest of the app. */
export async function fetchTokenMetadata(
  chain: Chain,
  address: Address,
  signal?: AbortSignal,
): Promise<TokenInfo> {
  const client = createPublicClient({
    chain,
    transport: http(`/api/rpc?chainId=${chain.id}`, {
      timeout: 10_000,
      retryCount: 0,
      fetchOptions: { signal },
    }),
  });
  const [decimalsResult, symbolResult] = await Promise.allSettled([
    client.readContract({ address, abi: erc20Abi, functionName: "decimals" }),
    client.readContract({ address, abi: erc20Abi, functionName: "symbol" }),
  ]);
  if (decimalsResult.status === "rejected")
    throw new Error("Token decimals could not be loaded.");
  const decimals = Number(decimalsResult.value);
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 255)
    throw new Error("Token decimals are invalid.");
  let symbol =
    symbolResult.status === "fulfilled" ? symbolResult.value.trim() : "";
  if (!symbol && !signal?.aborted) {
    // Some older ERC-20 contracts return bytes32 instead of string.
    try {
      const bytes = await client.readContract({
        address,
        abi: [
          {
            type: "function",
            name: "symbol",
            stateMutability: "view",
            inputs: [],
            outputs: [{ type: "bytes32" }],
          },
        ],
        functionName: "symbol",
      });
      symbol = hexToString(bytes, { size: 32 }).replace(/\0/g, "").trim();
    } catch {
      /* Decimals still let us show an accurate amount. */
    }
  }
  return {
    address,
    decimals,
    symbol: symbol || `${address.slice(0, 6)}…${address.slice(-4)}`,
  };
}
