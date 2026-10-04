import { queryOptions, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import type { TransactionReceipt } from "viem";
import { useConnection } from "wagmi";

export function transactionReceiptQueryOptions(
  chainId: number | undefined,
  hash: `0x${string}`,
) {
  return queryOptions({
    queryKey: ["transaction-receipt", chainId, hash],
    queryFn: async ({ signal }) => {
      if (!chainId) throw new Error("Chain is not connected");
      const params = new URLSearchParams({ chainId: String(chainId), hash });
      // The host endpoint waits for two confirmations. A transaction hash alone
      // only means the wallet broadcast it; the receipt determines success.
      const deadline = Date.now() + 180_000;
      while (Date.now() < deadline) {
        signal.throwIfAborted();
        const result = await fetch(`/api/transaction-receipt?${params.toString()}`, { signal });
        if (result.status === 202) {
          await new Promise<void>((resolve, reject) => {
            signal.throwIfAborted();
            const abort = () => { clearTimeout(timer); reject(signal.reason); };
            const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, 2_000);
            signal.addEventListener("abort", abort, { once: true });
          });
          continue;
        }
        if (!result.ok) {
          const data = await result.json().catch(() => undefined);
          throw new Error(data?.error ?? "Failed to get transaction receipt");
        }
        const receipt = (await result.json()) as TransactionReceipt;
        if (receipt.status === "reverted") throw new Error("Transaction failed");
        if (receipt.status !== "success") throw new Error("Invalid transaction receipt");
        return receipt;
      }
      throw new Error("Transaction is still pending. Check the explorer before retrying.");
    },
    // Reuse a successful confirmation when another step asks about the same hash.
    // Reverted/failed reads throw above and never become successful cached data.
    staleTime: Infinity,
    retry: false,
  });
}

/** Confirmation is an on-demand read; deduplicate it by chain and transaction hash. */
export function useGetTransactionReceipt() {
  const { chainId } = useConnection();
  const queryClient = useQueryClient();
  return useCallback(
    (hash: `0x${string}`) =>
      queryClient.fetchQuery(transactionReceiptQueryOptions(chainId, hash)),
    [chainId, queryClient],
  );
}
