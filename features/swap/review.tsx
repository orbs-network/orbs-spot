"use client";
import { useDeveloperMode } from "@/lib/hooks/use-developer-mode";
import { useSwapBestTrade } from "@/lib/hooks/use-swap-best-trade";
import { SubmitSwapButton } from "@/components/submit-swap-button";
import { useDerivedSwap } from "@/lib/hooks/use-derived-swap";
import { useActionHandlers } from "@/lib/hooks/use-action-handlers";
import { Step, SwapFlow, SwapStatus, Token } from "@orbs-network/swap-ui";
import { useCallback, useMemo, useState } from "react";
import { useFormatNumber, useToAmountUI } from "@/lib/hooks/common";
import { useBestTradeSwapStore } from "@/lib/hooks/store";
import { SwapStep, type Currency } from "@/lib/types";
import { useUSDPrice } from "@/lib/hooks/use-usd-price";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import BN from "bignumber.js";
import { cn, dynamicDecimals, getExplorerUrl } from "@/lib/utils";
import { useTranslations } from "@/lib/use-translations";
import { SwapFlowErrorIcon, SwapFlowLoader } from "@/components/swap-flow-loader";
import { DetailRow } from "@/components/ui/detail-row";
import { SwapFlowTokenLogo } from "@/components/ui/swap-flow-token-logo";
import { ArrowRightIcon, CheckIcon } from "lucide-react";
import { IS_ORBS } from "@/lib/partners/client";
import { OrbsTradeReviewSummary } from "@/components/orbs-trade-review-summary";
import { LiquidityHubDeveloperTrigger } from "@developer-tools";

const useStep = () => {
  const t = useTranslations();
  const currentStep = useBestTradeSwapStore((state) => state.currentStep);
  const txHash = useBestTradeSwapStore((state) => state.txHash);
  const inputCurrency = useBestTradeSwapStore(state => state.review?.inputCurrency);
  const chainId = useBestTradeSwapStore(state => state.review?.chainId);
  const explorerUrl = getExplorerUrl(chainId, txHash);

  return useMemo((): Step | undefined => {
    if (currentStep === SwapStep.WRAP) {
      return {
        title: `Wrap ${inputCurrency?.symbol ?? "token"}`,
        footerText: t("proceedInWallet"),
      };
    } else if (currentStep === SwapStep.APPROVE) {
      return {
        title: `Approve ${inputCurrency?.symbol ?? "token"}`,
        footerText: t("proceedInWallet"),
      };
    } else if (currentStep === SwapStep.SWAP) {
      return {
        title: "Swap",
        footerLink: explorerUrl,
        footerText: explorerUrl ? t("viewOnExplorer") : t("proceedInWallet"),
      };
    }
    return undefined;
  }, [currentStep, explorerUrl, inputCurrency?.symbol, t]);
};

const formatDynamicDecimals = (value: BN) => {
  if (!value.isFinite() || value.isNaN()) return "0.00";
  return dynamicDecimals(value.toString()) || "0.00";
};

const NetworkCost = () => {
  const { trade, outputCurrency } = useDerivedSwap();
  const amount = useToAmountUI(outputCurrency?.decimals, trade?.gas);
  const usd = useUSDPrice({
    token: outputCurrency?.address,
    amount: amount,
  });
  return (
    <DetailRow
      label="Network Cost"
      value={usd.data === undefined ? "—" : `$${usd.formatted}`}
      labelClassName="font-medium text-foreground"
      valueClassName="font-normal text-foreground"
    />
  );
};

const Rate = () => {
  const { inputAmount, outputAmount, inputCurrency, outputCurrency } =
    useDerivedSwap();

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
  const { trade, outputCurrency } = useDerivedSwap();
  const amount = useToAmountUI(outputCurrency?.decimals, trade?.minAmountOut);
  const usd = useUSDPrice({
    token: outputCurrency?.address,
    amount,
  });
  const formatted = useFormatNumber({ value: amount, decimalScale: 2 });
  return (
    <DetailRow
      label="Min. Amount Out"
      value={
        <span className="inline-flex flex-wrap justify-end gap-x-1">
          <span>
            {formatted ?? "0"} {outputCurrency?.symbol}
          </span>
          {usd.data !== undefined && <span className="text-muted-foreground">(${usd.formatted})</span>}
        </span>
      }
      labelClassName="font-medium text-foreground"
      valueClassName="font-normal text-foreground"
    />
  );
};
const Details = () => {
  return (
    <div data-review-details className="mt-3 flex w-full flex-col gap-2 rounded-[14px] border border-primary/25 bg-primary/10 p-3">
      <NetworkCost />
      <MinimumAmountOut />
      <Rate />
    </div>
  );
};

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
    <DialogContent data-trade-review data-orbs-swap-review={IS_ORBS && !status ? "" : undefined} presentation="center">
      {IS_ORBS && status ? (
        <DialogTitle className="sr-only">{title}</DialogTitle>
      ) : (
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
      )}
      <SwapFlow
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
          Failed: <SwapFlow.Failed />,
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
      />
    </DialogContent>
  );
};

export const SubmitSwap = () => {
  const { isDeveloperMode } = useDeveloperMode();
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const current = useDerivedSwap();
  const review = useBestTradeSwapStore(state => state.review);
  const { setInputAmount, } = useActionHandlers();
  const { status, isPreparing, totalSteps, currentStepIndex, reset } = useSwapBestTrade();
  const { inputCurrency, outputCurrency, inputAmount, outputAmount, isLoadingTrade } = status && review ? { ...current, ...review } : current;
  const inputAmountF = useFormatNumber({ value: inputAmount });
  const outputAmountF = useFormatNumber({ value: outputAmount });

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
    setOpen(true);
   if(status !== SwapStatus.LOADING) {
    reset();
   }
  }, [reset, setOpen, status]);

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
            text={isLoadingTrade ? t("fetchingQuote") : "Submit Swap"}
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
    useDerivedSwap();
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
  const inputUsdFormatted = useFormatNumber({ value: inputUsd.data, decimalScale: 2 });
  const outputUsdFormatted = useFormatNumber({ value: outputUsd.data, decimalScale: 2 });
  const inputAmountFormatted = useFormatNumber({ value: inputAmount });
  const outputAmountFormatted = useFormatNumber({ value: outputAmount });
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
          <p className="text-sm text-muted-foreground">${inputUsdFormatted}</p>
        }
        outUsd={
          <p className="text-sm text-muted-foreground">${outputUsdFormatted}</p>
        }
      />}
      {showReview && (
        <div className="mt-3 flex w-full flex-col gap-3">
          <Details />
          <SubmitSwapButton
            onClick={onSwapBestTrade}
            isLoading={isPreparing}
            text="Confirm Swap"
          />
        </div>
      )}
    </>
  );
};
