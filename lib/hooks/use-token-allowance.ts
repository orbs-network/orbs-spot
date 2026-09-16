import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { erc20Abi, type PublicClient } from "viem";
import { useConnection, usePublicClient } from "wagmi";

export type TokenAllowanceParams = {
  tokenAddress?: string;
  spenderAddress?: string;
  ownerAddress?: string;
};

// Shared read definition for rendered state (useQuery) and execution (fetchQuery).
export function tokenAllowanceQueryOptions(
  publicClient: Pick<PublicClient, "chain" | "readContract"> | undefined,
  { ownerAddress, spenderAddress, tokenAddress }: TokenAllowanceParams,
) {
  return queryOptions({
    // Allowance belongs to owner + token + spender on one chain. The requested
    // amount is not part of the read; compare it against the returned allowance.
    queryKey: [
      "allowance",
      publicClient?.chain?.id,
      ownerAddress?.toLowerCase(),
      tokenAddress?.toLowerCase(),
      spenderAddress?.toLowerCase(),
    ],
    queryFn: async () => {
      if (!publicClient) throw new Error("Public client not found");
      if (!ownerAddress || !spenderAddress || !tokenAddress) {
        throw new Error("Missing required allowance parameters");
      }
      const allowance = await publicClient.readContract({
        address: tokenAddress as `0x${string}`,
        abi: erc20Abi,
        functionName: "allowance",
        args: [ownerAddress as `0x${string}`, spenderAddress as `0x${string}`],
      });
      return allowance.toString();
    },
    enabled: Boolean(
      publicClient && ownerAddress && spenderAddress && tokenAddress,
    ),
    // Execution must reread chain state, especially immediately after approval.
    staleTime: 0,
    retry: false,
  });
}

export function useTokenAllowance(params: TokenAllowanceParams) {
  const publicClient = usePublicClient();
  const { address } = useConnection();
  return useQuery(
    tokenAllowanceQueryOptions(publicClient, {
      ...params,
      ownerAddress: params.ownerAddress ?? address,
    }),
  );
}

/** On-demand reads share the same query cache as rendered allowance state. */
export function useGetTokenAllowance() {
  const queryClient = useQueryClient();
  const publicClient = usePublicClient();
  const { address } = useConnection();
  // The wallet port supplies parameters when execution starts. fetchQuery gives
  // that imperative call the same cache and request deduplication as useQuery.
  return useCallback(
    (params: TokenAllowanceParams) =>
      queryClient.fetchQuery(
        tokenAllowanceQueryOptions(publicClient, {
          ...params,
          ownerAddress: params.ownerAddress ?? address,
        }),
      ),
    [queryClient, publicClient, address],
  );
}
