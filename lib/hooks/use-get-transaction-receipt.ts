import { useMutation } from "@tanstack/react-query";
import { TransactionReceipt } from "viem";
import { useConnection } from "wagmi";

export const useGetTransactionReceiptCallback = () => {
  const chainId = useConnection().chainId;
  return useMutation({
    mutationFn: async (hash: `0x${string}`) => {
      if (!chainId) {
        throw new Error("Chain is not connected");
      }

      const params = new URLSearchParams({
        chainId: String(chainId),
        hash,
      });
      const result = await fetch(
        `/api/transaction-receipt?${params.toString()}`
      );

      if (!result.ok) {
        const data = await result.json().catch(() => undefined);
        throw new Error(data?.error ?? "Failed to get transaction receipt");
      }

      const receipt = (await result.json()) as TransactionReceipt;
      if (receipt.status === "reverted") {
        throw new Error(
          receipt.logs?.[0]?.data?.toString() ?? "Transaction failed"
        );
      }
      return receipt;
    },
  });
};
