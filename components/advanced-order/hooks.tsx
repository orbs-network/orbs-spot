"use client";

import { useBalances } from "@/lib/hooks/use-balances";
import { useToAmountWei } from "@/lib/hooks/common";
import { useDerivedSwap } from "@/lib/hooks/use-derived-swap";
import { Currency } from "@/lib/types";
import { getWrappedNativeCurrency } from "@/lib/utils";
import { useGetTransactionReceipt } from "@/lib/hooks/use-get-transaction-receipt";
import { useSignTypedDataPayload } from "@/lib/hooks/use-sign-typed-data";
import { useApproveToken } from "@/lib/hooks/use-token-approval";
import { useGetTokenAllowance } from "@/lib/hooks/use-token-allowance";
import { useUSDPrice } from "@/lib/hooks/use-usd-price";
import { useWrapNativeToken } from "@/lib/hooks/use-wrap";
import { useOrderSubmitFlowStore } from "@/lib/hooks/store";
import { type OrderSigningRequest, type Token } from "@orbs-network/spot-ui";
import type { SpotWalletPort } from "@/lib/spot/execution";
import BN from "bignumber.js";
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
    inputCurrency,
    outputCurrency,
    inputAmount,
  } = useDerivedSwap();
  const inputUsd = useUSDPrice({
    token: inputCurrency?.address,
    amount: inputAmount || "0",
  });
  const outputUsd = useUSDPrice({ token: outputCurrency?.address });

  const defaultOutputAmount = useMemo(() => {
    const inputUsdValue = BN(inputUsd.data ?? 0);
    const outputTokenUsd = BN(outputUsd.data ?? 0);

    if (
      !outputCurrency ||
      !inputUsdValue.isFinite() ||
      !outputTokenUsd.isFinite() ||
      inputUsdValue.lte(0) ||
      outputTokenUsd.lte(0)
    ) {
      return "";
    }

    return inputUsdValue
      .div(outputTokenUsd)
      .decimalPlaces(outputCurrency.decimals, BN.ROUND_DOWN)
      .toFixed();
  }, [inputUsd.data, outputCurrency, outputUsd.data]);
  const defaultOutputAmountWei = useToAmountWei(
    outputCurrency?.decimals,
    defaultOutputAmount,
  );
  const defaultPriceLoading = inputUsd.isLoading || outputUsd.isLoading;

  return useMemo(
    () => ({
      value: trade?.outAmount ?? defaultOutputAmountWei,
      isLoading: trade?.outAmount ? isLoadingTrade : defaultPriceLoading,
      noLiquidity,
    }),
    [
      defaultOutputAmountWei,
      defaultPriceLoading,
      isLoadingTrade,
      noLiquidity,
      trade?.outAmount,
    ],
  );
}

// Bridge the SDK's Promise-based wallet port to this app's wagmi mutations and queries.
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
  const setPendingWrappedInputAddress = useOrderSubmitFlowStore(
    (state) => state.setPendingWrappedInputAddress,
  );

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
      wrapNativeToken: async (amount) => {
        const { hash } = await wrapNativeToken(amount);
        // Apply the token change when the review closes, after the confirmed deposit.
        const wrappedAddress = getWrappedNativeCurrency(
          walletClient?.chain.id,
        )?.address;
        if (wrappedAddress) setPendingWrappedInputAddress(wrappedAddress);
        void refetchBalances().catch(() => undefined);
        return hash;
      },
      approveToken: async (request) => {
        const { hash } = await approveToken(request);
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
      signOrder: async (request: OrderSigningRequest) => {
        if (!walletClient) throw new Error("Wallet client not found");
        return signTypedData({
          domain: request.typedData.domain,
          types: request.typedData.types,
          primaryType: request.typedData.primaryType,
          message: { ...request.typedData.message },
          account: request.signerAddress,
        });
      },
      getAllowance: (request) => getTokenAllowance(request),
    }),
    [
      approveToken,
      getTokenAllowance,
      signTypedData,
      waitForTransactionReceipt,
      walletClient,
      wrapNativeToken,
      refetchBalances,
      setPendingWrappedInputAddress,
    ],
  );
}
