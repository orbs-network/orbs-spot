/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import TokensPair from "@/components/tokens-pair";
import { useActionHandlers } from "@/lib/hooks/use-action-handlers";
import { useRefetchSelectedCurrenciesBalances } from "@/lib/hooks/use-balances";
import { useDerivedSwap } from "@/lib/hooks/use-derived-swap";
import {
  isUserRejectedError,
  showTransactionRejectedToast,
} from "@/lib/tx-rejection";
import { useTranslations } from "@/lib/use-translations";
import { Currency, Field } from "@/lib/types";
import {
  getExplorerUrl,
  getWrappedNativeCurrency,
} from "@/lib/utils";
import {
  getNetwork,
  isNativeAddress,
  type ApproveTokenProps,
  type Callbacks,
  type CancelOrderProps,
  type GetAllowanceProps,
  type OnApproveSuccessCallback,
  type OnCancelOrderSuccess,
  type OnWrapSuccessCallback,
  type Order,
  type ParsedError,
  type SignOrderProps,
  type Token,
  type WalletInteractions,
} from "@orbs-network/spot-react";
import { useCallback, useMemo } from "react";
import { toast } from "sonner";
import { type Abi, erc20Abi, maxUint256 } from "viem";
import { useConnection, usePublicClient, useWalletClient } from "wagmi";
import {
  APPROVE_TOAST_ID,
  CANCEL_ORDER_TOAST_ID,
  CREATE_ORDER_TOAST_ID,
  WRAP_TOAST_ID,
} from "./constants";

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
  const { trade, isLoadingTrade, noLiquidity } = useDerivedSwap();

  return useMemo(
    () => ({
      value: trade?.outAmount,
      isLoading: isLoadingTrade,
      noLiquidity,
    }),
    [isLoadingTrade, noLiquidity, trade?.outAmount],
  );
}

export function useWalletInteractions() {
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const { chainId } = useConnection();

  const waitForTx = useCallback(
    async (hash: `0x${string}`) => {
      if (!chainId) {
        throw new Error("Chain is not connected");
      }

      const result = await fetch(
        `/api/transaction-receipt?chainId=${chainId}&hash=${hash}`,
      );

      if (!result.ok) {
        throw new Error("Failed to get transaction receipt");
      }

      const receipt = await result.json();
      if (receipt?.status === "reverted") {
        throw new Error("Transaction reverted");
      }

      return hash;
    },
    [chainId],
  );

  return useMemo((): WalletInteractions => {
    const network = getNetwork(chainId);

    return {
      wrapNativeToken: async (amount: string) => {
        if (!walletClient) {
          throw new Error("Wallet client not found");
        }
        if (!network?.wToken?.address) {
          throw new Error("Wrapped native token not found for chain");
        }

        try {
          const hash = await walletClient.writeContract({
            abi: [
              {
                name: "deposit",
                type: "function",
                stateMutability: "payable",
                inputs: [],
                outputs: [],
              },
            ],
            functionName: "deposit",
            address: network.wToken.address as `0x${string}`,
            args: [],
            value: BigInt(amount),
            chain: walletClient.chain,
            account: walletClient.account!,
          });

          return waitForTx(hash);
        } catch (error) {
          if (isUserRejectedError(error)) {
            showTransactionRejectedToast({ id: WRAP_TOAST_ID });
          }

          throw error;
        }
      },
      approveToken: async (props: ApproveTokenProps) => {
        if (!walletClient) {
          throw new Error("Wallet client not found");
        }

        try {
          const hash = await walletClient.writeContract({
            abi: erc20Abi,
            functionName: "approve",
            address: props.tokenAddress as `0x${string}`,
            args: [props.spenderAddress as `0x${string}`, maxUint256],
            chain: walletClient.chain,
            account: walletClient.account!,
          });

          return waitForTx(hash);
        } catch (error) {
          if (isUserRejectedError(error)) {
            showTransactionRejectedToast({ id: APPROVE_TOAST_ID });
          }

          throw error;
        }
      },
      cancelOrder: async (props: CancelOrderProps) => {
        if (!walletClient) {
          throw new Error("Wallet client not found");
        }

        try {
          const hash = await walletClient.writeContract({
            abi: props.abi as Abi,
            functionName: "cancel",
            address: props.contractAddress as `0x${string}`,
            args: props.args as any,
            chain: walletClient.chain,
            account: walletClient.account!,
          } as any);

          return waitForTx(hash);
        } catch (error) {
          if (isUserRejectedError(error)) {
            showTransactionRejectedToast({ id: CANCEL_ORDER_TOAST_ID });
          }

          throw error;
        }
      },
      signOrder: async (props: SignOrderProps) => {
        if (!walletClient) {
          throw new Error("Wallet client not found");
        }

        try {
          return await walletClient.signTypedData({
            domain: props.domain as any,
            types: props.types as any,
            primaryType: props.primaryType,
            message: props.message as any,
            account: props.account,
          });
        } catch (error) {
          if (isUserRejectedError(error)) {
            showTransactionRejectedToast({ id: CREATE_ORDER_TOAST_ID });
          }

          throw error;
        }
      },
      getAllowance: async (props: GetAllowanceProps) => {
        if (!publicClient) {
          throw new Error("Public client not found");
        }
        if (!walletClient?.account?.address) {
          throw new Error("Wallet account not found");
        }

        const result = await publicClient.readContract({
          address: props.tokenAddress as `0x${string}`,
          abi: erc20Abi,
          functionName: "allowance",
          args: [
            walletClient.account.address as `0x${string}`,
            props.spenderAddress as `0x${string}`,
          ],
        });

        return String(result);
      },
    };
  }, [chainId, publicClient, waitForTx, walletClient]);
}

export function useSpotCallbacks() {
  const t = useTranslations();
  const { inputCurrency, outputCurrency } = useDerivedSwap();
  const { handleCurrencyChange } = useActionHandlers();
  const { chainId } = useConnection();
  const { mutateAsync: refetchBalances } =
    useRefetchSelectedCurrenciesBalances();

  const approvalSymbol = useMemo(() => {
    if (!inputCurrency) return "";
    if (isNativeAddress(inputCurrency.address)) {
      return getWrappedNativeCurrency(chainId)?.symbol ?? inputCurrency.symbol;
    }
    return inputCurrency.symbol;
  }, [chainId, inputCurrency]);

  const explorerLink = useCallback(
    (txHash?: string) => getExplorerUrl(chainId, txHash),
    [chainId],
  );

  const callbacks = useMemo((): Callbacks => {
    return {
      onWrapRequest: () => {
        toast.loading(
          `${t("wrapAction", { symbol: inputCurrency?.symbol ?? "token" })}...`,
          {
            id: WRAP_TOAST_ID,
            description: t("proceedInWallet"),
          },
        );
      },
      onWrapSuccess: async ({ txHash }: OnWrapSuccessCallback) => {
        const network = getNetwork(chainId);
        const wrappedAddress = network?.wToken?.address;

        if (wrappedAddress) {
          handleCurrencyChange(wrappedAddress, Field.INPUT);
        }

        toast.success(
          t("wrapAction", { symbol: inputCurrency?.symbol ?? "token" }),
          {
            id: WRAP_TOAST_ID,
            description: explorerLink(txHash) ? (
              <a href={explorerLink(txHash)} target="_blank" rel="noreferrer">
                {t("viewOnExplorer")}
              </a>
            ) : undefined,
          },
        );
        await refetchBalances();
      },
      onApproveRequest: () => {
        toast.loading(
          `${t("approveAction", { symbol: approvalSymbol || "token" })}...`,
          {
            id: APPROVE_TOAST_ID,
            description: t("proceedInWallet"),
          },
        );
      },
      onApproveSuccess: ({ txHash }: OnApproveSuccessCallback) => {
        toast.success(
          t("approveAction", { symbol: approvalSymbol || "token" }),
          {
            id: APPROVE_TOAST_ID,
            description: explorerLink(txHash) ? (
              <a href={explorerLink(txHash)} target="_blank" rel="noreferrer">
                {t("viewOnExplorer")}
              </a>
            ) : undefined,
          },
        );
      },
      onSignOrderRequest: () => {
        toast.loading(
          <TokensPair
            prefix={t("placeOrder")}
            srcTokenAddress={inputCurrency?.address}
            dstTokenAddress={outputCurrency?.address}
          />,
          { id: CREATE_ORDER_TOAST_ID, description: t("proceedInWallet") },
        );
      },
      onOrderCreated: (order: Order) => {
        toast.success(
          <TokensPair
            prefix={t("Completed")}
            srcTokenAddress={order.srcTokenAddress}
            dstTokenAddress={order.dstTokenAddress}
          />,
          {
            id: CREATE_ORDER_TOAST_ID,
            duration: 10_000,
            closeButton: true,
          },
        );
        refetchBalances();
      },
      onOrderFilled: (order: Order) => {
        toast.success(
          <TokensPair
            prefix={t("Completed")}
            srcTokenAddress={order.srcTokenAddress}
            dstTokenAddress={order.dstTokenAddress}
          />,
        );
        refetchBalances();
      },
      onSubmitOrderFailed: ({ code, message }: ParsedError) => {
        if (isUserRejectedError({ code, message })) {
          showTransactionRejectedToast({ id: CREATE_ORDER_TOAST_ID });
          return;
        }

        toast.error(
          code ? `Transaction failed: ${code}` : "Transaction failed",
          {
            id: CREATE_ORDER_TOAST_ID,
            description: message,
          },
        );
      },
      onSubmitOrderRejected: () => {
        showTransactionRejectedToast({ id: CREATE_ORDER_TOAST_ID });
      },
      onCancelOrderRequest: () => {
        toast.loading(`${t("cancelOrder")}...`, {
          id: CANCEL_ORDER_TOAST_ID,
          description: t("proceedInWallet"),
        });
      },
      onCancelOrderSuccess: ({ txHash }: OnCancelOrderSuccess) => {
        toast.success(t("Cancelled"), {
          id: CANCEL_ORDER_TOAST_ID,
          description: explorerLink(txHash) ? (
            <a href={explorerLink(txHash)} target="_blank" rel="noreferrer">
              {t("viewOnExplorer")}
            </a>
          ) : undefined,
        });
        refetchBalances();
      },
      onCancelOrderFailed: (error: Error) => {
        if (isUserRejectedError(error)) {
          showTransactionRejectedToast({ id: CANCEL_ORDER_TOAST_ID });
          return;
        }

        toast.error("Cancel failed", {
          id: CANCEL_ORDER_TOAST_ID,
          description: error.message,
        });
      },
      onOrdersProgressUpdate: () => {
        refetchBalances();
      },
      onCopy: () => {
        toast.success("Copied");
      },
    };
  }, [
    approvalSymbol,
    chainId,
    explorerLink,
    handleCurrencyChange,
    inputCurrency?.address,
    inputCurrency?.symbol,
    outputCurrency?.address,
    refetchBalances,
    t,
  ]);

  return callbacks;
}

