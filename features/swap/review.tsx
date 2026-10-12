"use client";
import { useDeveloperMode } from "@/lib/hooks/use-developer-mode";
import { useSwapBestTrade } from "@/lib/hooks/use-swap-best-trade";
import { SubmitSwapButton } from "@/components/submit-swap-button";
import { useDerivedSwap } from "@/lib/hooks/use-derived-swap";
import { useActionHandlers } from "@/lib/hooks/use-action-handlers";
import { Step, SwapFlow, SwapStatus, Token } from "@orbs-network/swap-ui";
import { useCallback, useEffect, useMemo } from "react";
import { useFormatNumber, useToAmountUI } from "@/lib/hooks/common";
import { useBestTradeSwapStore } from "@/lib/hooks/store";
import { SwapStep, type Currency } from "@/lib/types";
import { useUSDPrice } from "@/lib/hooks/use-usd-price";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import BN from "bignumber.js";
import { cn, getExplorerUrl } from "@/lib/utils";
import { useTranslations } from "@/lib/use-translations";
import { SwapFlowErrorIcon, SwapFlowLoader } from "@/components/swap-flow-loader";
import { DetailRow } from "@/components/ui/detail-row";
import { SwapFlowTokenLogo } from "@/components/ui/swap-flow-token-logo";
import { ArrowRightIcon, CheckIcon } from "lucide-react";
import { IS_ORBS } from "@/lib/partners/client";
import { OrbsTradeReviewSummary } from "@/components/orbs-trade-review-summary";
import { LiquidityHubDeveloperTrigger } from "@developer-tools";
import { trackFunnel } from "@/lib/funnel-analytics";
import { useReviewQuote } from "./use-review-quote";
import { TransactionError } from "@/components/transaction-error";
import { Button } from "@/components/ui/button";
import { toAmountUI } from "@/lib/utils";
import { tokenDisplayDecimals, displayTokenAmount, formatDisplayAmount } from "@/lib/token-display";

const useStep = () => {
  const t = useTranslations();
  const currentStep = useBestTradeSwapStore((state) => state.currentStep);
  const txHash = useBestTradeSwapStore((state) => state.txHash);
  const isAwaitingWallet = useBestTradeSwapStore((state) => state.isAwaitingWallet);
  const inputCurrency = useBestTradeSwapStore(state => state.review?.inputCurrency);
  const chainId = useBestTradeSwapStore(state => state.review?.chainId);
  const explorerUrl = getExplorerUrl(chainId, txHash);

  return useMemo((): Step | undefined => {
    if (currentStep === SwapStep.WRAP) {
      return {
        title: `Wrap ${inputCurrency?.symbol ?? "token"}`,
        footerText: isAwaitingWallet ? t("proceedInWallet") : t("transactionSubmitted"),
      };
    } else if (currentStep === SwapStep.APPROVE) {
      return {
        title: `Approve ${inputCurrency?.symbol ?? "token"}`,
        footerText: isAwaitingWallet ? t("proceedInWallet") : t("transactionSubmitted"),
      };
    } else if (currentStep === SwapStep.SWAP) {
      return {
        title: "Swap",
        footerLink: explorerUrl,
        footerText: txHash ? t("transactionSubmitted") : isAwaitingWallet ? t("proceedInWallet") : "Submitting swap…",
      };
    }
    return undefined;
  }, [currentStep, explorerUrl, inputCurrency?.symbol, isAwaitingWallet, t, txHash]);
};

const formatDynamicDecimals = (value: BN) => {
  if (!value.isFinite() || value.isNaN()) return "0.00";
  return formatDisplayAmount(value.toString()) || "0.00";
};

const NetworkCost = () => {
  const { quote, outputCurrency } = useReviewQuote();
  const amount = useToAmountUI(outputCurrency?.decimals, quote?.gasAmountOut);
  const usd = useUSDPrice({
    token: outputCurrency?.address,
    amount: amount,
  });
  return (
    <DetailRow
      label="Estimated execution cost"
      tooltip="Quoted execution cost in the output token. Wallet gas for approval or wrapping is additional and shown by your wallet."
      value={quote?.gasAmountOut === undefined ? "Not provided" : usd.data === undefined ? `${formatDisplayAmount(amount)} ${outputCurrency?.symbol}` : usd.formatted}
      labelClassName="font-medium text-foreground"
      valueClassName="font-normal text-foreground"
    />
  );
};

const Rate = () => {
  const { inputAmount, outputAmount, inputCurrency, outputCurrency } =
    useReviewQuote();

  const rateText = useMemo(() => {
    const input = BN(inputAmount || 0);
    const output = BN(outputAmount || 0);

    if (input.lte(0) || output.lte(0)) {
      return "0.00";
    }

    return formatDynamicDecimals(output.div(input));
  }, [outputAmount, inputAmount]);

  return (
    <DetailRow
      label="Rate"
      value={`1 ${inputCurrency?.symbol} = ${rateText} ${outputCurrency?.symbol}`}
      labelClassName="font-medium text-foreground"
      valueClassName="font-normal text-foreground"
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
      <NetworkCost />
      <MinimumAmountOut />
      <Rate />
      <DetailRow label="Slippage" value={quote ? `${quote.slippage}%` : "—"} />
      <DetailRow label="Price impact" value="Not provided" />
      <DetailRow label="Route" value="Orbs Liquidity Hub" tooltip="Swaps are executed through Orbs Liquidity Hub." />
    </div>
  );
};

function SwapFailure() {
  const error = useBestTradeSwapStore(state => state.error);
  return <SwapFlow.Failed error={<TransactionError error={error} />} />;
}

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

function SwapSuccessIcon() {
  return (
    <div data-flow-success-icon className="flex size-14 items-center justify-center rounded-full border border-primary/30 bg-primary/15 text-primary">
      <CheckIcon aria-hidden="true" className="size-7" strokeWidth={2.4} />
    </div>
  );
}

function SwapSuccessToken({
  amount,
  className,
  currency,
}: {
  amount?: string;
  className?: string;
  currency?: Currency;
}) {
  return (
    <div className={cn("flex min-w-0 items-center gap-2", className)}>
      <SwapFlowTokenLogo currency={currency} className="size-[26px]" />
      <span className="min-w-0 truncate text-sm font-semibold text-foreground">
        {amount || "0"} {currency?.symbol}
      </span>
    </div>
  );
}

const Success = ({
  inputAmountF,
  outputAmountF,
  inputCurrency,
  outputCurrency,
}: {
  inputAmountF?: string;
  outputAmountF?: string;
  inputCurrency?: Currency;
  outputCurrency?: Currency;
}) => {
  const t = useTranslations();
  const txHash = useBestTradeSwapStore((state) => state.txHash);
  const chainId = useBestTradeSwapStore(state => state.review?.chainId);
  const explorerUrl = getExplorerUrl(chainId, txHash);

  return (
    <SwapFlow.StepLayout
      className="orbs_Success"
      title="Swap completed"
      body={
        <div className="flex w-full flex-col items-center gap-3">
          <div data-review-pair className="grid w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 rounded-[14px] border border-primary/25 bg-primary/10 p-3">
            <SwapSuccessToken amount={inputAmountF} currency={inputCurrency} />
            <ArrowRightIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
            <SwapSuccessToken
              amount={outputAmountF}
              className="justify-end"
              currency={outputCurrency}
            />
          </div>
        </div>
      }
      footerLink={explorerUrl}
      footerText={explorerUrl ? t("viewOnExplorer") : undefined}
    />
  );
};

const SwapReviewContent = ({
  status,
  totalSteps,
  currentStepIndex,
  inputAmountF,
  outputAmountF,
  inputCurrency,
  outputCurrency,
  inToken,
  outToken,
}: {
  status?: SwapStatus;
  totalSteps?: number;
  currentStepIndex?: number;
  inputAmountF?: string;
  outputAmountF?: string;
  inputCurrency?: Currency;
  outputCurrency?: Currency;
  inToken: Token;
  outToken: Token;
}) => {
  const tokenLogoClassName = status ? "size-[26px]" : "size-10";
  const title = !status ? "Review swap" : status === SwapStatus.SUCCESS ? "Swap completed" : status === SwapStatus.FAILED ? "Swap not completed" : "Swap execution";

  return (
    <DialogContent className="flex flex-col overflow-hidden" data-trade-review data-orbs-swap-review={IS_ORBS && !status ? "" : undefined} presentation="center">
      {IS_ORBS && status ? (
        <DialogTitle className="sr-only">{title}</DialogTitle>
      ) : (
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
      )}
      <div data-review-scroll className="min-h-0 overflow-y-auto overscroll-contain"><SwapFlow
        inAmount={inputAmountF}
        outAmount={outputAmountF}
        swapStatus={status}
        totalSteps={totalSteps}
        currentStep={useStep()}
        currentStepIndex={currentStepIndex}
        inToken={inToken}
        outToken={outToken}
        components={{
          SrcTokenLogo: (
            <SwapFlowTokenLogo
              currency={inputCurrency}
              token={inToken}
              className={tokenLogoClassName}
            />
          ),
          DstTokenLogo: (
            <SwapFlowTokenLogo
              currency={outputCurrency}
              token={outToken}
              className={tokenLogoClassName}
            />
          ),
          Failed: <SwapFailure />,
          FailedIcon: <SwapFlowErrorIcon />,
          Success: (
            <Success
              inputAmountF={inputAmountF}
              outputAmountF={outputAmountF}
              inputCurrency={inputCurrency}
              outputCurrency={outputCurrency}
            />
          ),
          SuccessIcon: <SwapSuccessIcon aria-hidden="true" />,
          Main: <Main />,
          Loader: <SwapFlowLoader />,
        }}
      /></div>
    </DialogContent>
  );
};

export const SubmitSwap = () => {
  const { isDeveloperMode } = useDeveloperMode();
  const t = useTranslations();
  const open = useBestTradeSwapStore(state => state.isReviewOpen);
  const setOpen = useBestTradeSwapStore(state => state.setReviewOpen);
  useEffect(() => {
    if (isDeveloperMode) setOpen(false);
    return () => setOpen(false);
  }, [isDeveloperMode, setOpen]);
  const current = useDerivedSwap();
  const review = useBestTradeSwapStore(state => state.review);
  const { setInputAmount, } = useActionHandlers();
  const { status, isPreparing, totalSteps, currentStepIndex, reset } = useSwapBestTrade();
  const { inputCurrency, outputCurrency, inputAmount, outputAmount, isLoadingTrade } = status && review ? { ...current, ...review } : current;
  const inputAmountF = useFormatNumber({ value: inputAmount, decimalScale: tokenDisplayDecimals(inputCurrency?.symbol, inputCurrency?.decimals) });
  const outputAmountF = useFormatNumber({ value: outputAmount, decimalScale: tokenDisplayDecimals(outputCurrency?.symbol, outputCurrency?.decimals) });

  const inToken = useMemo(() => {
    return {
      symbol: inputCurrency?.symbol,
      logoUrl: inputCurrency?.logoUrl,
    };
  }, [inputCurrency]);

  const outToken = useMemo(() => {
    return {
      symbol: outputCurrency?.symbol,
      logoUrl: outputCurrency?.logoUrl,
    };
  }, [outputCurrency]);

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

  if (isDeveloperMode) {
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
          <SwapReviewContent
            status={isPreparing ? undefined : status}
            totalSteps={totalSteps}
            currentStepIndex={currentStepIndex}
            inputAmountF={inputAmountF}
            outputAmountF={outputAmountF}
            inputCurrency={inputCurrency}
            outputCurrency={outputCurrency}
            inToken={inToken}
            outToken={outToken}
          />
        </Dialog>
      </div>
    </div>
  );
};

const Main = () => {
  const t = useTranslations();
  const { inputAmount, outputAmount, inputCurrency, outputCurrency } =
    useReviewQuote();
  const quoteUpdate = useBestTradeSwapStore(state => state.quoteUpdate);
  const { status, isPreparing, onSwapBestTrade } = useSwapBestTrade();
  const showReview = !status || isPreparing;
  const inputUsd = useUSDPrice({
    token: inputCurrency?.address,
    amount: inputAmount,
  });
  const outputUsd = useUSDPrice({
    token: outputCurrency?.address,
    amount: outputAmount,
  });
  const inputUsdFormatted = useFormatNumber({ value: inputUsd.data, decimalScale: 2, prefix: "$" });
  const outputUsdFormatted = useFormatNumber({ value: outputUsd.data, decimalScale: 2, prefix: "$" });
  const inputAmountFormatted = useFormatNumber({ value: inputAmount, decimalScale: tokenDisplayDecimals(inputCurrency?.symbol, inputCurrency?.decimals) });
  const outputAmountFormatted = useFormatNumber({ value: outputAmount, decimalScale: tokenDisplayDecimals(outputCurrency?.symbol, outputCurrency?.decimals) });
  return (
    <>
      {IS_ORBS && showReview ? (
        <OrbsTradeReviewSummary
          pay={{ currency: inputCurrency, amount: inputAmountFormatted, usd: inputUsd.isLoading || inputUsd.isError ? undefined : inputUsdFormatted }}
          receive={{ currency: outputCurrency, amount: outputAmountFormatted, usd: outputUsd.isLoading || outputUsd.isError ? undefined : outputUsdFormatted }}
        />
      ) : <SwapFlow.Main
        fromTitle={t("from")}
        toTitle={t("to")}
        inUsd={
          <p className="text-sm text-muted-foreground">{inputUsdFormatted}</p>
        }
        outUsd={
          <p className="text-sm text-muted-foreground">{outputUsdFormatted}</p>
        }
      />}
      {showReview && (
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
      )}
    </>
  );
};
