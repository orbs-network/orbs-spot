import { useMutation } from "@tanstack/react-query";
import BN from "bignumber.js";
import { erc20Abi } from "viem";
import { useConnection, usePublicClient } from "wagmi";

export type TokenAllowanceParams = {
  tokenAddress?: string;
  spenderAddress?: string;
  ownerAddress?: string;
};

export type HasTokenAllowanceParams = TokenAllowanceParams & {
  amount?: string;
};

export const useGetTokenAllowance = () => {
  const publicClient = usePublicClient();
  const { address } = useConnection();

  return useMutation({
    mutationFn: async ({
      ownerAddress = address,
      spenderAddress,
      tokenAddress,
    }: TokenAllowanceParams) => {
      if (!publicClient) {
        throw new Error("Public client not found");
      }
      if (!ownerAddress || !spenderAddress || !tokenAddress) {
        throw new Error("Missing required allowance parameters");
      }

      const allowance = await publicClient.readContract({
        address: tokenAddress as `0x${string}`,
        abi: erc20Abi,
        functionName: "allowance",
        args: [
          ownerAddress as `0x${string}`,
          spenderAddress as `0x${string}`,
        ],
      });

      return allowance.toString();
    },
  });
};

export const useHasTokenAllowance = () => {
  const { mutateAsync: getTokenAllowance } = useGetTokenAllowance();

  return useMutation({
    mutationFn: async (params: HasTokenAllowanceParams) => {
      if (!params.amount) {
        throw new Error("Missing required allowance amount");
      }

      const allowance = await getTokenAllowance(params);
      return BN(allowance).gte(BN(params.amount));
    },
  });
};
