"use client";

import { useRef } from "react";
import BN from "bignumber.js";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { SubmitButtonBase } from "@/components/submit-swap-button";
import { useDerivedSwap } from "@/lib/hooks/use-derived-swap";
import { useBalance } from "@/lib/hooks/use-balances";
import { useDataChainId } from "@/lib/hooks/use-data-chain-id";
import { useWrapNativeToken, useUnwrapNativeToken } from "@/lib/hooks/use-wrap";
import type { NativeConversion } from "@/lib/native-conversion";
import { getExplorerUrl } from "@/lib/utils";
import { isUserRejectedError } from "@/lib/tx-rejection";
import { useTranslations } from "@/lib/use-translations";
import { useSwapStore } from "@/lib/hooks/store";

export function SubmitNativeConversion({ direction }: { direction: NativeConversion }) {
  const t = useTranslations();
  const { inputCurrency, outputCurrency, inputAmount, parsedInputAmount } = useDerivedSwap();
  const balance = useBalance(inputCurrency);
  const chainId = useDataChainId();
  const wrap = useWrapNativeToken();
  const unwrap = useUnwrapNativeToken();
  const queryClient = useQueryClient();
  const submitting = useRef(false);
  const isPending = wrap.isPending || unwrap.isPending;
  const action = direction === "wrap" ? "Wrap" : "Unwrap";
  const amount = BN(parsedInputAmount);
  const enterAmount = !amount.isFinite() || !amount.isInteger() || amount.lte(0);
  const insufficientBalance = BN(balance.wei ?? "0").lt(amount);

  async function submit() {
    if (submitting.current || enterAmount || insufficientBalance || !inputCurrency || !outputCurrency) return;
    submitting.current = true;
    const toastId = toast.loading(`${action} ${inputCurrency.symbol}`, {
      description: "Confirm the transaction in your wallet.",
    });
    try {
      const convert = direction === "wrap" ? wrap.mutateAsync : unwrap.mutateAsync;
      const { hash } = await convert({
        amount: parsedInputAmount,
        onSubmitted: () => toast.loading(`${action} ${inputCurrency.symbol}`, {
          id: toastId, description: "Waiting for transaction confirmation…",
        }),
      });
      const explorerUrl = getExplorerUrl(chainId, hash);
      toast.success(direction === "wrap" ? "Wrap completed" : "Unwrap completed", {
        id: toastId,
        description: explorerUrl ? <a href={explorerUrl} target="_blank" rel="noopener noreferrer" className="underline">View on explorer</a> : undefined,
      });
      // Do not discard an amount edited while the wallet was confirming.
      if (useSwapStore.getState().inputAmount === inputAmount) useSwapStore.getState().setInputAmount("");
    } catch (error) {
      if (isUserRejectedError(error)) toast.dismiss(toastId);
      else toast.error(`${action} failed`, {
        id: toastId,
        description: error instanceof Error ? error.message : "The transaction could not be completed. Try again.",
      });
    } finally {
      submitting.current = false;
      // A broadcast may have succeeded even if waiting for its receipt failed.
      void queryClient.invalidateQueries({ queryKey: ["balances"] });
    }
  }

  return <SubmitButtonBase
    chainId={chainId}
    onClick={() => void submit()}
    isLoading={isPending}
    disabled={enterAmount || insufficientBalance || !inputCurrency || !outputCurrency || balance.isLoading}
    text={enterAmount ? t("enterAmount") : balance.isLoading ? "Loading balance…" : insufficientBalance ? t("insufficientFunds") : action}
  />;
}
