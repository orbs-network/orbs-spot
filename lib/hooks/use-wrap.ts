import { useMutation } from "@tanstack/react-query";
import { useConnection, useWalletClient } from "wagmi";
import { getWrappedNativeCurrency } from "../utils";
import wethAbi from "../abi/wethAbi.json";
import { useGetTransactionReceipt } from "./use-get-transaction-receipt";
import type { TransactionResult } from "./use-token-approval";

type WrapRequest = {
  amount: string;
  onSubmitted?: (hash: `0x${string}`) => void;
};

export const useWrapNativeToken = () => {
  const { data: walletClient } = useWalletClient();
  const { address: account, chainId } = useConnection();
  const getTransactionReceiptCallback = useGetTransactionReceipt();

  const address = getWrappedNativeCurrency(chainId)?.address ?? "";
  return useMutation({
    mutationFn: async (request: string | WrapRequest): Promise<TransactionResult> => {
      const { amount, onSubmitted } = typeof request === "string" ? { amount: request } : request;
      if (!walletClient) {
        throw new Error("Wallet client not found");
      }
      if (!address) {
        throw new Error("Wrapped native currency address not found");
      }
      // deposit receives native currency in base units and mints the wrapped ERC-20.
      const hash = await walletClient.writeContract({
        abi: wethAbi,
        functionName: "deposit",
        account,
        address: address as `0x${string}`,
        value: BigInt(amount),
        chain: walletClient.chain,
      });
      onSubmitted?.(hash);
      // The wrapped balance is usable only after the deposit succeeds on chain.
      const receipt = await getTransactionReceiptCallback(hash);
      return { hash, receipt };
    },
  });
};

export const useWrap = (onSubmitted?: (hash: `0x${string}`) => void) => {
  const { mutateAsync: wrapNativeToken } = useWrapNativeToken();

  return useMutation({
    mutationFn: async (amount: string) => {
      const { receipt } = await wrapNativeToken({ amount, onSubmitted });
      return receipt;
    },
  });
};
