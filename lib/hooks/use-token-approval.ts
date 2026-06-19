import { useMutation } from "@tanstack/react-query";
import { erc20Abi, type TransactionReceipt } from "viem";
import { useConnection, useWalletClient } from "wagmi";
import { useGetTransactionReceiptCallback } from "./use-get-transaction-receipt";

export type ApproveTokenParams = {
  tokenAddress?: string;
  spenderAddress?: string;
  amount?: string;
};

export type TransactionResult = {
  hash: `0x${string}`;
  receipt: TransactionReceipt;
};

export const useApproveToken = () => {
  const { data: walletClient } = useWalletClient();
  const { address: account } = useConnection();
  const { mutateAsync: getTransactionReceipt } =
    useGetTransactionReceiptCallback();

  return useMutation({
    mutationFn: async ({
      amount,
      spenderAddress,
      tokenAddress,
    }: ApproveTokenParams): Promise<TransactionResult> => {
      if (!walletClient) {
        throw new Error("Wallet client not found");
      }
      if (!tokenAddress || !spenderAddress || !amount) {
        throw new Error("Missing required approval parameters");
      }

      const hash = await walletClient.writeContract({
        address: tokenAddress as `0x${string}`,
        abi: erc20Abi,
        functionName: "approve",
        args: [spenderAddress as `0x${string}`, BigInt(amount)],
        account,
        chain: walletClient.chain,
      });

      const receipt = await getTransactionReceipt(hash);
      return { hash, receipt };
    },
  });
};
