import { useMutation } from "@tanstack/react-query";
import { useConnection, useWalletClient } from "wagmi";
import { getWrappedNativeCurrency } from "../utils";
import wethAbi from "../abi/wethAbi.json";
import { useGetTransactionReceiptCallback } from "./use-get-transaction-receipt";
import type { TransactionResult } from "./use-token-approval";

export const useWrapNativeToken = () => {
  const { data: walletClient } = useWalletClient();
  const { address: account, chainId } = useConnection();
  const { mutateAsync: getTransactionReceiptCallback } =
    useGetTransactionReceiptCallback();

  const address = getWrappedNativeCurrency(chainId)?.address ?? "";
  return useMutation({
    mutationFn: async (amount: string): Promise<TransactionResult> => {
      if (!walletClient) {
        throw new Error("Wallet client not found");
      }
      if (!address) {
        throw new Error("Wrapped native currency address not found");
      }
      const hash = await walletClient.writeContract({
        abi: wethAbi,
        functionName: "deposit",
        account,
        address: address as `0x${string}`,
        value: BigInt(amount),
        chain: walletClient.chain,
      });
      const receipt = await getTransactionReceiptCallback(hash);
      return { hash, receipt };
    },
  });
};

export const useWrap = () => {
  const { mutateAsync: wrapNativeToken } = useWrapNativeToken();

  return useMutation({
    mutationFn: async (amount: string) => {
      const { receipt } = await wrapNativeToken(amount);
      return receipt;
    },
  });
};
