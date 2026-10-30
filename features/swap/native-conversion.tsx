"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import BN from "bignumber.js";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { SubmitButtonBase } from "@/components/submit-swap-button";
import { TradeToastDetails } from "@/components/ui/trade-toast-details";
import { useDerivedSwap } from "@/lib/hooks/use-derived-swap";
import { useBalance } from "@/lib/hooks/use-balances";
import { useDataChainId } from "@/lib/hooks/use-data-chain-id";
import { useWrapNativeToken, useUnwrapNativeToken } from "@/lib/hooks/use-wrap";
import type { NativeConversion } from "@/lib/native-conversion";
import { isUserRejectedError } from "@/lib/tx-rejection";
import { useTranslations } from "@/lib/use-translations";
import { useSwapStore } from "@/lib/hooks/store";
import { useConnection } from "wagmi";
import { useSubmissionPreview } from "@/lib/submission-preview";
import { acquireSubmissionLock, isSubmissionBusy, subscribeSubmissionLock } from "@/lib/spot/submission-lock";
import { createLoadingToast } from "@/lib/loading-toast";

export function SubmitNativeConversion({ direction }: { direction: NativeConversion }) {
  const t = useTranslations();
  const { inputCurrency, outputCurrency, inputAmount, parsedInputAmount } = useDerivedSwap();
  const balance = useBalance(inputCurrency);
  const chainId = useDataChainId();
  const { address: account } = useConnection();
  const wrap = useWrapNativeToken();
  const unwrap = useUnwrapNativeToken();
  const queryClient = useQueryClient();
  const submitting = useRef(false);
  const draftChanged = useRef(false);
  const walletBusy = useSyncExternalStore(subscribeSubmissionLock, isSubmissionBusy, () => false);
  useEffect(() => {
    if (submitting.current) draftChanged.current = true;
  }, [account, chainId, direction, inputCurrency?.address, outputCurrency?.address, inputAmount]);
  useEffect(() => () => { draftChanged.current = true; }, []);
  const isPending = wrap.isPending || unwrap.isPending;
  const action = direction === "wrap" ? "Wrap" : "Unwrap";
  const amount = BN(parsedInputAmount);
  const enterAmount = !amount.isFinite() || !amount.isInteger() || amount.lte(0);
  const insufficientBalance = BN(balance.wei ?? "0").lt(amount);

  async function submit() {
    if (submitting.current || enterAmount || insufficientBalance || !inputCurrency || !outputCurrency) return;
    let releaseWallet: (() => void) | undefined;
    try { releaseWallet = acquireSubmissionLock(); }
    catch { toast.info("Confirm the pending wallet request before starting another submission."); return; }
    submitting.current = true;
    draftChanged.current = false;
    const draftUrl = window.location.href;
    let transactionHash: string | undefined;
    const toastInput = { token: { ...inputCurrency }, amount: inputAmount };
    const toastOutput = { token: { ...outputCurrency }, amount: inputAmount };
    const toastId = `native-conversion-${crypto.randomUUID()}`;
    const loadingToast = createLoadingToast(toastId);
    const toastTitle = `${action} ${inputCurrency.symbol}`;
    const publishPreview = (title: string, status: "pending" | "success" | "error", message?: string) => {
      useSubmissionPreview.getState().upsert({ id: toastId, kind: direction, title, status, message,
        input: toastInput, output: toastOutput, chainId, account,
        transactions: transactionHash ? [{ label: `${action} transaction`, hash: transactionHash }] : [],
      });
    };
    const toastDetails = (message?: string) => <TradeToastDetails
      input={toastInput}
      output={toastOutput}
      message={message}
      chainId={chainId}
      transactions={transactionHash ? [{ label: `${action} transaction`, hash: transactionHash }] : []}
    />;
    publishPreview(`${action} ${inputCurrency.symbol}`, "pending", "Confirm the transaction in your wallet.");
    loadingToast.show(toastTitle, {
      description: toastDetails("Confirm the transaction in your wallet."),
    });
    try {
      const convert = direction === "wrap" ? wrap.mutateAsync : unwrap.mutateAsync;
      const { hash } = await convert({
        amount: parsedInputAmount,
        onSubmitted: (hash) => {
          releaseWallet?.();
          releaseWallet = undefined;
          transactionHash = hash;
          publishPreview(`${action} ${inputCurrency.symbol}`, "pending", "Waiting for transaction confirmation");
          loadingToast.show(toastTitle, {
            description: toastDetails("Waiting for transaction confirmation"),
          });
        },
      });
      transactionHash = hash;
      publishPreview(direction === "wrap" ? "Wrap completed" : "Unwrap completed", "success");
      toast.success(direction === "wrap" ? "Wrap completed" : "Unwrap completed", {
        id: toastId,
        description: toastDetails(),
      });
      // Do not discard an amount edited while the wallet was confirming.
      if (!draftChanged.current && window.location.href === draftUrl && useSwapStore.getState().inputAmount === inputAmount) useSwapStore.getState().setInputAmount("");
    } catch (error) {
      publishPreview(`${action} failed`, "error", error instanceof Error ? error.message : "The transaction could not be completed. Try again.");
      if (isUserRejectedError(error) && !transactionHash) toast.dismiss(toastId);
      else toast.error(`${action} failed`, {
        id: toastId,
        description: toastDetails(error instanceof Error ? error.message : "The transaction could not be completed. Try again."),
      });
    } finally {
      releaseWallet?.();
      submitting.current = false;
      // A broadcast may have succeeded even if waiting for its receipt failed.
      void queryClient.invalidateQueries({ queryKey: ["balances"] });
    }
  }

  return <SubmitButtonBase
    chainId={chainId}
    onClick={() => void submit()}
    isLoading={isPending}
    disabled={walletBusy || enterAmount || insufficientBalance || !inputCurrency || !outputCurrency || balance.isLoading}
    text={enterAmount ? t("enterAmount") : balance.isLoading ? "Loading balance…" : insufficientBalance ? t("insufficientFunds") : action}
  />;
}
