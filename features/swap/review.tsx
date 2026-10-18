"use client";
import { useDeveloperMode } from "@/lib/hooks/use-developer-mode";
import { useSwapBestTrade } from "@/lib/hooks/use-swap-best-trade";
import { SubmitSwapButton } from "@/components/submit-swap-button";
import { useDerivedSwap } from "@/lib/hooks/use-derived-swap";
import { useActionHandlers } from "@/lib/hooks/use-action-handlers";
import { useCallback, useEffect } from "react";
import { useFormatNumber, useToAmountUI } from "@/lib/hooks/common";
import { useBestTradeSwapStore } from "@/lib/hooks/store";
import { SwapStatus, SwapStep } from "@/lib/types";
import { useUSDPrice } from "@/lib/hooks/use-usd-price";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn, getExplorerUrl, toAmountUI } from "@/lib/utils";
import { useTranslations } from "@/lib/use-translations";
import { DetailRow } from "@/components/ui/detail-row";
import { OrbsTradeReviewSummary } from "@/components/orbs-trade-review-summary";
import { LiquidityHubDeveloperTrigger } from "@developer-tools";
import { trackFunnel } from "@/lib/funnel-analytics";
import { useReviewQuote } from "./use-review-quote";
import { Button } from "@/components/ui/button";
import { tokenDisplayDecimals, displayTokenAmount, formatDisplayAmount } from "@/lib/token-display";
import { getExchangeRates } from "@/lib/exchange-rates";
import { TokenExchangeRate } from "@/components/exchange-rate";
import { LiquidityHubRoute } from "./liquidity-hub-route";
import { SubmissionSteps, SubmissionOutcome, SubmissionSuccess, type SubmissionStep } from "@/components/submission-status";
import type { TradeReviewLayout } from "@/components/orbs-trade-review-summary";
import { ExternalLinkIcon } from "lucide-react";

const Rate = () => {
  const { quote, inputCurrency, outputCurrency } =
    useReviewQuote();

  const rates = getExchangeRates({
    inAmount: quote?.inAmount, outAmount: quote?.outAmount,
    inputDecimals: inputCurrency?.decimals, outputDecimals: outputCurrency?.decimals,
  });

  return (
    <DetailRow
      label="Rate"
      value={
        <TokenExchangeRate rates={rates} inputCurrency={inputCurrency} outputCurrency={outputCurrency} />
      }
      labelClassName="font-medium text-foreground"
      valueClassName="ml-auto max-w-full font-normal text-foreground"
    />
  );
};

const MinimumAmountOut = () => {
  const { quote, outputCurrency } = useReviewQuote();
  const amount = useToAmountUI(outputCurrency?.decimals, quote?.minAmountOut);
  const usd = useUSDPrice({
    token: outputCurrency?.address,
    amount,
  });
  const formatted = useFormatNumber({ value: amount, decimalScale: tokenDisplayDecimals(outputCurrency?.symbol, outputCurrency?.decimals) });
  return (
    <DetailRow
      label="Minimum received"
      value={
        <span className="inline-flex flex-wrap justify-end gap-x-1">
          <span>
            {formatted ?? "0"} {outputCurrency?.symbol}
          </span>
          {usd.data !== undefined && <span className="text-muted-foreground">({usd.formatted})</span>}
        </span>
      }
      labelClassName="font-medium text-foreground"
      valueClassName="font-normal text-foreground"
    />
  );
};
const Details = () => {
  const { quote } = useReviewQuote();
  return (
    <div data-review-details className="mt-3 flex w-full flex-col gap-2 rounded-[14px] border border-primary/25 bg-primary/10 p-3">
      <MinimumAmountOut />
      <Rate />
      <DetailRow label="Slippage" value={quote ? `${quote.slippage}%` : "—"} />
      <LiquidityHubRoute />
    </div>
  );
};

function UpdatedQuoteNotice() {
  const update = useBestTradeSwapStore(state => state.quoteUpdate);
  const updateStore = useBestTradeSwapStore(state => state.updateStore);
  const { outputCurrency } = useDerivedSwap();
  if (!update) return null;
  const amount = (raw: string) => displayTokenAmount(toAmountUI(raw, outputCurrency?.decimals), outputCurrency?.symbol, outputCurrency?.decimals);
  return <div role="status" className="rounded-2xl bg-secondary p-4 text-sm">
    <p className="font-medium">Price updated: {amount(update.previous.outAmount)} → {amount(update.next.outAmount)} {outputCurrency?.symbol}</p>
    <p className="mt-1 text-xs text-muted-foreground">Minimum received: {amount(update.previous.minAmountOut)} → {amount(update.next.minAmountOut)} {outputCurrency?.symbol}. Review the updated price before signing.</p>
    <Button className="mt-3 w-full" onClick={() => updateStore({ reviewedQuote: update.next, quoteUpdate: undefined })}>Accept updated price</Button>
  </div>;
}

function SwapAmountSummary({ layout = "review" }: { layout?: TradeReviewLayout }) {
  const current = useReviewQuote();
  const status = useBestTradeSwapStore(state => state.status);
  const reviewed = useBestTradeSwapStore(state => state.review);
  // Keep the reviewed amounts and pair visible while wallet actions are pending.
  const { inputCurrency, outputCurrency, inputAmount, outputAmount } = status && reviewed ? reviewed : current;
  const inputUsd = useUSDPrice({ token: inputCurrency?.address, amount: inputAmount });
  const outputUsd = useUSDPrice({ token: outputCurrency?.address, amount: outputAmount });
  const inputUsdFormatted = useFormatNumber({ value: inputUsd.data, decimalScale: 2, prefix: "$" });
  const outputUsdFormatted = useFormatNumber({ value: outputUsd.data, decimalScale: 2, prefix: "$" });
  const inputAmountFormatted = useFormatNumber({ value: inputAmount, decimalScale: tokenDisplayDecimals(inputCurrency?.symbol, inputCurrency?.decimals) });
  const outputAmountFormatted = useFormatNumber({ value: outputAmount, decimalScale: tokenDisplayDecimals(outputCurrency?.symbol, outputCurrency?.decimals) });
  return <OrbsTradeReviewSummary layout={layout}
    pay={{ currency: inputCurrency, amount: inputAmountFormatted, usd: inputUsd.isLoading || inputUsd.isError ? undefined : inputUsdFormatted }}
    receive={{ currency: outputCurrency, amount: outputAmountFormatted, usd: outputUsd.isLoading || outputUsd.isError ? undefined : outputUsdFormatted }}
  />;
}

function SwapSuccess({ onClose }: { onClose: () => void }) {
  const review = useBestTradeSwapStore(state => state.review);
  const txHash = useBestTradeSwapStore(state => state.txHash);
  const explorerUrl = getExplorerUrl(review?.chainId, txHash);

  // Use the submitted trade snapshot so later quote refreshes cannot change the pair.
  return <div data-swap-execution="success"><SubmissionSuccess
    summary={review ? {
      input: `${formatDisplayAmount(review.inputAmount)} ${review.inputCurrency.symbol}`,
      output: `${formatDisplayAmount(review.outputAmount)} ${review.outputCurrency.symbol}`,
    } : undefined}
    message="Your swap has been completed successfully."
    onClose={onClose}
  >
    {explorerUrl && <a href={explorerUrl} target="_blank" rel="noopener noreferrer">
      View on explorer<ExternalLinkIcon aria-hidden="true" className="size-3" />
    </a>}
  </SubmissionSuccess></div>;
}

function SwapSubmissionStatus({ onClose }: { onClose: () => void }) {
  const { status, steps = [], currentStep, currentStepIndex = 0, isAwaitingWallet,
    wrapTxHash, approvalTxHash, txHash, error, review, resetStore } = useBestTradeSwapStore();
  const failed = status === SwapStatus.FAILED;
  const symbol = review?.inputCurrency.symbol ?? "token";
  const titles = {
    [SwapStep.WRAP]: `Wrap ${symbol}`,
    [SwapStep.APPROVE]: `Approve ${symbol}`,
    [SwapStep.SWAP]: "Sign and submit swap",
  };
  const hashes = { [SwapStep.WRAP]: wrapTxHash, [SwapStep.APPROVE]: approvalTxHash, [SwapStep.SWAP]: txHash };
  const walletSteps = steps.map((id): SubmissionStep => ({
    id,
    title: titles[id],
    action: id === SwapStep.WRAP ? "wrap" : id === SwapStep.APPROVE ? "approve" : "sign",
    transactionHash: hashes[id],
    transactionUrl: getExplorerUrl(review?.chainId, hashes[id]),
  }));
  const instruction = isAwaitingWallet
    ? currentStep === SwapStep.WRAP ? "Confirm wrapping in your wallet."
      : currentStep === SwapStep.APPROVE ? "Confirm approval in your wallet." : "Confirm the signature in your wallet."
    : txHash ? "Waiting for confirmation…" : "Submitting swap…";

  if (status === SwapStatus.SUCCESS) return <SwapSuccess onClose={onClose} />;

  return <div data-swap-execution={failed ? "failed" : "loading"} className={cn("flex w-full flex-col gap-3", !failed && "mt-3")}>
    <section role={failed ? "alert" : "status"} aria-live={failed ? "assertive" : "polite"} aria-atomic="true" className={cn("flex flex-col gap-2", !failed && "pt-1")}>
      {failed && <SubmissionOutcome outcome="error" title="Swap not completed" message={error?.message} />}
      {status === SwapStatus.LOADING && <SubmissionSteps steps={walletSteps} activeStep={currentStepIndex} instruction={instruction} />}
    </section>
    {failed && <Button className="h-12 w-full rounded-[14px] text-base" onClick={resetStore}>Back to review</Button>}
  </div>;
}

function SwapReviewContent({ status, onClose }: { status?: SwapStatus; onClose: () => void }) {
  return <DialogContent className="flex max-w-[480px] flex-col overflow-hidden border-0 outline-none" data-trade-review data-orbs-swap-review presentation="center">
    <DialogHeader><DialogTitle>{status === SwapStatus.SUCCESS ? "Swap completed" : "Review swap"}</DialogTitle></DialogHeader>
    <div data-review-scroll className="min-h-0 overflow-y-auto overscroll-contain">
      {!status ? <Main /> : <>
        {status === SwapStatus.LOADING && <SwapAmountSummary layout="submission" />}
        <SwapSubmissionStatus onClose={onClose} />
      </>}
    </div>
  </DialogContent>;
}

export const SubmitSwap = () => {
  const { isDeveloperPlayground } = useDeveloperMode();
  const t = useTranslations();
  const open = useBestTradeSwapStore(state => state.isReviewOpen);
  const setOpen = useBestTradeSwapStore(state => state.setReviewOpen);
  useEffect(() => {
    if (isDeveloperPlayground) setOpen(false);
    return () => setOpen(false);
  }, [isDeveloperPlayground, setOpen]);
  const current = useDerivedSwap();
  const { setInputAmount, } = useActionHandlers();
  const { status, isPreparing, reset } = useSwapBestTrade();
  const { isLoadingTrade } = current;

  const closeReview = useCallback(() => {
    setOpen(false);
    if(status === SwapStatus.SUCCESS) {
      setInputAmount('');
    }
  }, [setInputAmount, setOpen, status]);

  const onOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        setOpen(true);
        return;
      }
      closeReview();
    },
    [closeReview, setOpen]
  );

  const onOpen = useCallback(() => {
    trackFunnel({ name: "review_opened", product: "swap" });
    setOpen(true);
   if(status !== SwapStatus.LOADING) {
    reset();
    useBestTradeSwapStore.getState().updateStore({ reviewedQuote: current.trade?.originalQuote });
   }
  }, [reset, setOpen, status, current.trade]);

  if (isDeveloperPlayground) {
    return <div className="flex w-full items-center gap-2">
      <LiquidityHubDeveloperTrigger mode="live" />
      <LiquidityHubDeveloperTrigger mode="demo" />
    </div>;
  }

  return (
    <div className="flex w-full items-center gap-2">
      <div className="min-w-0 flex-1">
        <Dialog open={open} onOpenChange={onOpenChange}>
          <SubmitSwapButton
            onClick={onOpen}
            isLoading={isLoadingTrade}
            text={isLoadingTrade ? t("fetchingQuote") : "Review"}
          />
          <SwapReviewContent status={isPreparing ? undefined : status} onClose={closeReview} />
        </Dialog>
      </div>
    </div>
  );
};

const Main = () => {
  const quoteUpdate = useBestTradeSwapStore(state => state.quoteUpdate);
  const { isPreparing, onSwapBestTrade } = useSwapBestTrade();
  return (
    <>
        <SwapAmountSummary />
        <div className="mt-3 flex w-full flex-col gap-3">
          <Details />
          <UpdatedQuoteNotice />
          <SubmitSwapButton
            disabled={Boolean(quoteUpdate)}
            onClick={onSwapBestTrade}
            isLoading={isPreparing}
            text="Swap"
          />
        </div>
    </>
  );
};
