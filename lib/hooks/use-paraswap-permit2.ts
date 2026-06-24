import { useMutation } from "@tanstack/react-query";
import { useConnection, usePublicClient } from "wagmi";
import type { Address } from "viem";
import { useSignTypedDataPayload } from "./use-sign-typed-data";
import {
  encodeParaswapPermit2,
  getPermit2Amount,
  getPermit2Domain,
  PERMIT2_ADDRESS,
  PERMIT2_MAX_EXPIRATION,
  permit2Abi,
  permit2Types,
} from "../permit2";

type SignParaswapPermit2Params = {
  amount?: string;
  deadline: number;
  spenderAddress?: string;
  tokenAddress?: string;
};

export const useSignParaswapPermit2 = () => {
  const publicClient = usePublicClient();
  const { address: account, chainId } = useConnection();
  const { mutateAsync: signTypedData } = useSignTypedDataPayload();

  return useMutation({
    mutationFn: async ({
      amount,
      deadline,
      spenderAddress,
      tokenAddress,
    }: SignParaswapPermit2Params) => {
      if (!publicClient) {
        throw new Error("Public client not found");
      }
      if (!account || !chainId) {
        throw new Error("Wallet is not connected");
      }
      if (!amount || !spenderAddress || !tokenAddress) {
        throw new Error("Missing Permit2 parameters");
      }

      const permitAmount = getPermit2Amount(amount);
      const [, , nonce] = await publicClient.readContract({
        address: PERMIT2_ADDRESS,
        abi: permit2Abi,
        functionName: "allowance",
        args: [
          account as Address,
          tokenAddress as Address,
          spenderAddress as Address,
        ],
      });

      const signature = await signTypedData({
        account: account as Address,
        domain: getPermit2Domain(chainId),
        types: permit2Types,
        primaryType: "PermitSingle",
        message: {
          details: {
            token: tokenAddress,
            amount: permitAmount,
            expiration: PERMIT2_MAX_EXPIRATION,
            nonce,
          },
          spender: spenderAddress,
          sigDeadline: BigInt(deadline),
        },
      });

      return encodeParaswapPermit2({
        amount,
        deadline,
        owner: account as Address,
        signature,
        spender: spenderAddress as Address,
      });
    },
  });
};
