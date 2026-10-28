"use client";

import { useBalances } from "@/lib/hooks/use-balances";
import { useDerivedSwap } from "@/lib/hooks/use-derived-swap";
import { Currency } from "@/lib/types";
import { useGetTransactionReceipt } from "@/lib/hooks/use-get-transaction-receipt";
import { useSignTypedDataPayload } from "@/lib/hooks/use-sign-typed-data";
import { useApproveToken } from "@/lib/hooks/use-token-approval";
import { useGetTokenAllowance } from "@/lib/hooks/use-token-allowance";
import { useWrapNativeToken } from "@/lib/hooks/use-wrap";
import { QuoteError, type Token } from "@orbs-network/spot-ui";
import type { SpotWalletPort } from "@/lib/spot/execution";
import { useMemo } from "react";
import { type Abi } from "viem";
import { useWalletClient } from "wagmi";
export function useSpotToken(currency?: Currency) {
  return useMemo((): Token | undefined => {
    if (!currency) return undefined;

    return {
      address: currency.address,
      decimals: currency.decimals,
      symbol: currency.symbol,
      logoUrl: currency.logoUrl,
    };
  }, [currency]);
}

export function useSpotMarketReferencePrice() {
  const {
    trade,
    isLoadingTrade,
    noLiquidity,
    quoteError,
    refetchTrade,
  } = useDerivedSwap();

  return useMemo(
    () => ({
      // USD prices are valuation inputs only. A missing or failed quote must
      // leave the SDK form unready rather than inventing an execution rate.
      value: !isLoadingTrade && !quoteError ? trade?.outAmount : undefined,
      isLoading: isLoadingTrade,
      noLiquidity: noLiquidity || (quoteError instanceof QuoteError && quoteError.kind === "no-quote"),
      error: quoteError,
      refetch: refetchTrade,
    }),
    [isLoadingTrade, noLiquidity, quoteError, refetchTrade, trade?.outAmount],
  );
}

// Connect the app's executor to wagmi. Spot supplies request data; the host
// wallet signs it and waits for each on-chain transaction to be confirmed.
export function useWalletInteractions() {
  const { data: walletClient } = useWalletClient();
  const waitForTransactionReceipt = useGetTransactionReceipt();
  // The executor must await each step and stop on rejection, so use mutateAsync
  // here. UI buttons use mutate when they do not need to await a result.
  const { mutateAsync: signTypedData } = useSignTypedDataPayload();
  const { mutateAsync: approveToken } = useApproveToken();
  const getTokenAllowance = useGetTokenAllowance();
  const { mutateAsync: wrapNativeToken } = useWrapNativeToken();

  const { refetch: refetchBalances } = useBalances();

  return useMemo(
    (): SpotWalletPort => ({
      // Wallet prompts can remain open while the user changes accounts or networks.
      // Read the wallet again before each critical step instead of trusting render state.
      assertContext: async (account, chainId) => {
        if (!walletClient) throw new Error("Wallet client not found");
        const [addresses, connectedChain] = await Promise.all([
          walletClient.getAddresses(),
          walletClient.getChainId(),
        ]);
        if (
          connectedChain !== chainId ||
          addresses[0]?.toLowerCase() !== account.toLowerCase()
        ) {
          throw new Error(
            "Wallet account or network changed. Review the order again.",
          );
        }
      },
      wrapNativeToken: async (amount, onSubmitted) => {
        const { hash } = await wrapNativeToken({ amount, onSubmitted });
        void refetchBalances().catch(() => undefined);
        return hash;
      },
      approveToken: async (request, onSubmitted) => {
        const { hash } = await approveToken({ ...request, onSubmitted });
        return hash;
      },
      cancelOrder: async (request) => {
        if (!walletClient) throw new Error("Wallet client not found");
        const hash = await walletClient.writeContract({
          abi: request.abi as Abi,
          functionName: "cancel",
          address: request.contractAddress as `0x${string}`,
          args: request.args,
          chain: walletClient.chain,
          account: walletClient.account,
        });
        await waitForTransactionReceipt(hash);
        return hash;
      },
      // Forward the SDK's typed data unchanged; rebuilding it can invalidate the signature.
      signOrder: async (request) => {
        if (!walletClient) throw new Error("Wallet client not found");
        return signTypedData({
          ...request.typedData,
          message: { ...request.typedData.message },
          account: request.signerAddress,
        });
      },
      getAllowance: getTokenAllowance,
    }),
    [
      approveToken,
      getTokenAllowance,
      signTypedData,
      waitForTransactionReceipt,
      walletClient,
      wrapNativeToken,
      refetchBalances,
    ],
  );
}
