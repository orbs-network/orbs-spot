import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useConnection, usePublicClient } from "wagmi";
import { useMemo } from "react";
import { useParseNativeCurrencyAddress } from "./common";
import { useApproveToken } from "./use-token-approval";
import { useHasTokenAllowance } from "./use-token-allowance";
import { maxUint256 } from "viem";

export const useApproval = (
  spender: string,
  _currencyAddress?: string,
  amount?: string
) => {
  const currencyAddress = useParseNativeCurrencyAddress(_currencyAddress);
  const { address: account } = useConnection();
  const publicClient = usePublicClient();
  const { mutateAsync: approveToken } = useApproveToken();
  const { mutateAsync: hasTokenAllowance } = useHasTokenAllowance();
  const queryClient = useQueryClient();
  const allowanceKey = useMemo(
    () => ["allowance", account, spender, currencyAddress, amount],
    [account, spender, currencyAddress, amount]
  );

  const { data: hasAllowance, isLoading: isLoadingHasAllowance } = useQuery({
    queryKey: allowanceKey,
    queryFn: async () => {
      return hasTokenAllowance({
        tokenAddress: currencyAddress,
        spenderAddress: spender,
        amount,
      });
    },
    enabled:
      !!publicClient && !!account && !!spender && !!currencyAddress && !!amount,
  });

  const { mutateAsync: approveCallback, isPending: isPendingApproval } =
    useMutation({
      mutationFn: async () => {
        const { receipt } = await approveToken({
          tokenAddress: currencyAddress,
          spenderAddress: spender,
          amount: maxUint256.toString(),
        });

        const hasAllowance = await hasTokenAllowance({
          tokenAddress: currencyAddress,
          spenderAddress: spender,
          amount,
        });

        if (!hasAllowance) {
          throw new Error("Approval failed");
        }

        queryClient.setQueryData(allowanceKey, true);
        return receipt;
      },
    });

  const { mutateAsync: ensureAllowance } = useMutation({
    mutationFn: async () => {
      return queryClient.ensureQueryData({
        queryKey: allowanceKey,
        queryFn: async () => {
          return hasTokenAllowance({
            tokenAddress: currencyAddress,
            spenderAddress: spender,
            amount,
          });
        },
      });
    },
  });

  return useMemo(
    () => ({
      hasAllowance,
      isLoadingHasAllowance,
      approve: approveCallback,
      isPendingApproval,
      ensureAllowance,
    }),
    [
      approveCallback,
      ensureAllowance,
      hasAllowance,
      isLoadingHasAllowance,
      isPendingApproval,
    ]
  );
};
