/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import TokensPair from "@/components/tokens-pair";
import { useActionHandlers } from "@/lib/hooks/use-action-handlers";
import { useRefetchSelectedCurrenciesBalances } from "@/lib/hooks/use-balances";
import { useToAmountWei } from "@/lib/hooks/common";
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
import { useGetTransactionReceiptCallback } from "@/lib/hooks/use-get-transaction-receipt";
import { useSignTypedDataPayload } from "@/lib/hooks/use-sign-typed-data";
import { useApproveToken } from "@/lib/hooks/use-token-approval";
import { useGetTokenAllowance } from "@/lib/hooks/use-token-allowance";
import { useUSDPrice } from "@/lib/hooks/use-usd-price";
import { useWrapNativeToken } from "@/lib/hooks/use-wrap";
import {
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
import BN from "bignumber.js";
import { useCallback, useMemo } from "react";
import { toast } from "sonner";
import { type Abi, maxUint256 } from "viem";
import { useConnection, useWalletClient } from "wagmi";
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
  const { trade, isLoadingTrade, noLiquidity, inputCurrency, outputCurrency, inputAmount } =
    useDerivedSwap();
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

export function useWalletInteractions() {
  const { data: walletClient } = useWalletClient();
  const { mutateAsync: waitForTransactionReceipt } =
    useGetTransactionReceiptCallback();
  const { mutateAsync: signTypedData } = useSignTypedDataPayload();
  const { mutateAsync: approveToken } = useApproveToken();
  const { mutateAsync: getTokenAllowance } = useGetTokenAllowance();
  const { mutateAsync: wrapNativeToken } = useWrapNativeToken();

  return useMemo((): WalletInteractions => {
    return {
      wrapNativeToken: async (amount: string) => {
        try {
          const { hash } = await wrapNativeToken(amount);
          return hash;
        } catch (error) {
          if (isUserRejectedError(error)) {
            showTransactionRejectedToast({ id: WRAP_TOAST_ID });
          }

          throw error;
        }
      },
      approveToken: async (props: ApproveTokenProps) => {
        try {
          const { hash } = await approveToken({
            tokenAddress: props.tokenAddress,
            spenderAddress: props.spenderAddress,
            amount: maxUint256.toString(),
          });
          return hash;
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

          await waitForTransactionReceipt(hash);
          return hash;
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
          return await signTypedData({
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
        return getTokenAllowance({
          tokenAddress: props.tokenAddress,
          spenderAddress: props.spenderAddress,
        });
      },
    };
  }, [
    approveToken,
    getTokenAllowance,
    signTypedData,
    waitForTransactionReceipt,
    walletClient,
    wrapNativeToken,
  ]);
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
        const wrappedAddress = getWrappedNativeCurrency(chainId)?.address;

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
            prefix={t("orderPlaced")}
            srcTokenAddress={order.srcTokenAddress}
            dstTokenAddress={order.dstTokenAddress}
          />,
          { id: CREATE_ORDER_TOAST_ID },
        );
      },
      onOrderFilled: (order: Order) => {
        toast.success(
          <TokensPair
            prefix={t("orderFilled")}
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
