import { useMutation } from "@tanstack/react-query";
import BN from "bignumber.js";
import { useCallback } from "react";
import { useParseNativeCurrencyAddress } from "./common";
import { useApproveToken } from "./use-token-approval";
import { useGetTokenAllowance, useTokenAllowance } from "./use-token-allowance";

export const useApproval = (
  spender: string,
  _currencyAddress?: string,
  amount?: string,
) => {
  const currencyAddress = useParseNativeCurrencyAddress(_currencyAddress);
  const { mutateAsync: approveToken } = useApproveToken();
  // Subscribe for display, but reread immediately before execution: a cached
  // allowance may have been spent or changed by another transaction.
  const allowance = useTokenAllowance({
    tokenAddress: currencyAddress,
    spenderAddress: spender,
  });
  const getTokenAllowance = useGetTokenAllowance();
  const ensureAllowance = useCallback(() => {
    // Fail before querying RPC when there is no amount to check.
    if (!amount)
      return Promise.reject(new Error("Missing required allowance amount"));
    return getTokenAllowance({
      tokenAddress: currencyAddress,
      spenderAddress: spender,
    }).then((data) => BN(data ?? "0").gte(amount));
  }, [getTokenAllowance, currencyAddress, spender, amount]);

  const { mutateAsync: approve, isPending: isPendingApproval } = useMutation({
    mutationFn: async () => {
      const { receipt } = await approveToken({
        tokenAddress: currencyAddress,
        spenderAddress: spender,
        amount,
      });
      // Check the actual allowance after confirmation, rather than assuming the write took effect.
      if (!(await ensureAllowance())) throw new Error("Approval failed");
      return receipt;
    },
    retry: false,
  });

  return {
    hasAllowance:
      allowance.data === undefined || !amount
        ? undefined
        : BN(allowance.data).gte(amount),
    isLoadingHasAllowance: allowance.isLoading,
    approve,
    isPendingApproval,
    ensureAllowance,
  };
};
