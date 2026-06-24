"use client";
import { CurrencyCard } from "./currency-card";
import { useSwapBestTrade } from "@/lib/hooks/use-swap-best-trade";
import { ToggleCurrencies } from "./toggle-currencies";
import { SubmitSwapButton } from "./submit-swap-button";
import { useDerivedSwap } from "@/lib/hooks/use-derived-swap";
import { useActionHandlers } from "@/lib/hooks/use-action-handlers";
import { SwapFlow, SwapStatus, type Step } from "@orbs-network/swap-ui";
import { useCallback, useMemo, useState } from "react";
import { useFormatNumber, useToAmountUI } from "@/lib/hooks/common";
import { useBestTradeSwapStore } from "@/lib/hooks/store";
import { Field, SwapStep } from "@/lib/types";
import { useUSDPrice } from "@/lib/hooks/use-usd-price";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import BN from "bignumber.js";
import { cn, dynamicDecimals, formatDecimals, getExplorerUrl } from "@/lib/utils";
import { useConnection } from "wagmi";
import { useTranslations } from "@/lib/use-translations";
import { SettingsModal } from "./settings-modal";
import { FormActionPanel } from "./form-action-panel";
import { SwapFlowLoader } from "./swap-flow-loader";
import { DetailRow } from "./ui/detail-row";
import { SwapFlowTokenLogo } from "./ui/swap-flow-token-logo";
import { ArrowRightIcon, CheckIcon } from "lucide-react";

const useStep = () => {
  const t = useTranslations();
  const currentStep = useBestTradeSwapStore((state) => state.currentStep);
  const executionMode = useBestTradeSwapStore((state) => state.executionMode);
  const txHash = useBestTradeSwapStore((state) => state.txHash);
  const { inputCurrency } = useDerivedSwap();
  const { chainId } = useConnection();
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
        footerText: explorerUrl
          ? t("viewOnExplorer")
          : executionMode === "gasless"
            ? t("waitingForGaslessOrder")
            : t("proceedInWallet"),
      };
    }
    return undefined;
  }, [currentStep, executionMode, explorerUrl, inputCurrency?.symbol, t]);
};

const formatSafeFixed = (value: BN, decimals = 2) => {
  if (!value.isFinite() || value.isNaN()) return "0.00";
  return value.toFixed(decimals);
};

const formatDynamicDecimals = (value: BN) => {
  if (!value.isFinite() || value.isNaN()) return "0.00";
  return dynamicDecimals(value.toString()) || "0.00";
};

const useSwapFlowPreview = () => {
  const { inputAmount, outputAmount, inputCurrency, outputCurrency } =
    useDerivedSwap();
  const inputAmountF = useFormatNumber({ value: inputAmount });
  const outputAmountF = useFormatNumber({ value: outputAmount });
  const inToken = useMemo(
    () => ({
      symbol: inputCurrency?.symbol,
      logoUrl: inputCurrency?.logoUrl,
    }),
    [inputCurrency?.logoUrl, inputCurrency?.symbol],
  );
  const outToken = useMemo(
    () => ({
      symbol: outputCurrency?.symbol,
      logoUrl: outputCurrency?.logoUrl,
    }),
    [outputCurrency?.logoUrl, outputCurrency?.symbol],
  );

  return {
    inputAmountF,
    outputAmountF,
    inputCurrency,
    outputCurrency,
    inToken,
    outToken,
  };
};

const PriceImpact = () => {
  const { outputCurrency, inputAmount, inputCurrency, outputAmount } =
    useDerivedSwap();
  const inputUsd = useUSDPrice({
    token: inputCurrency?.address,
    amount: inputAmount,
  });
  const outputUsd = useUSDPrice({
    token: outputCurrency?.address,
    amount: outputAmount,
  });
  const priceImpactText = useMemo(() => {
    const inputValue = BN(inputUsd.data ?? 0);
    const outputValue = BN(outputUsd.data ?? 0);

    if (inputValue.lte(0) || outputValue.lte(0)) {
      return "0.00";
    }

    return formatSafeFixed(
      BN(100).minus(outputValue.div(inputValue).multipliedBy(100))
    );
  }, [outputUsd.data, inputUsd.data]);

  return (
    <DetailRow
      label="Price Impact"
      value={`${priceImpactText}%`}
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
  const formatted = useFormatNumber({ value: amount });
  return (
    <DetailRow
      label="Minimum Amount Out"
      value={`${formatted ?? "0"} ${outputCurrency?.symbol}`}
      labelClassName="font-medium text-foreground"
      valueClassName="font-normal text-foreground"
    />
  );
};
const Details = () => {
  return (
    <div className="mt-3 flex w-full flex-col gap-2 rounded-[14px] border border-primary/25 bg-primary/10 p-3">
      {/* <NetworkCost /> */}
      <PriceImpact />
      <MinimumAmountOut />
      <Rate />
    </div>
  );
};

function SwapSuccessIcon() {
  return (
    <div className="flex size-14 items-center justify-center rounded-full border border-primary/30 bg-primary/15 text-primary">
      <CheckIcon className="size-7" strokeWidth={2.4} />
    </div>
  );
}

function SwapSuccessToken({
  field,
  className,
}: {
  field: Field;
  className?: string;
}) {
  const { inputAmount, outputAmount, inputCurrency, outputCurrency } =
    useDerivedSwap();
  const isInput = field === Field.INPUT;
  const amount = useFormatNumber({
    value: isInput ? inputAmount : outputAmount,
  });
  const currency = isInput ? inputCurrency : outputCurrency;

  return (
    <div className={cn("flex min-w-0 items-center gap-2", className)}>
      <SwapFlowTokenLogo currency={currency} className="size-[26px]" />
      <span className="min-w-0 truncate text-sm font-semibold text-foreground">
        {amount || "0"} {currency?.symbol}
      </span>
    </div>
  );
}

const Success = () => {
  const t = useTranslations();
  const txHash = useBestTradeSwapStore((state) => state.txHash);
  const { chainId } = useConnection();
  const explorerUrl = getExplorerUrl(chainId, txHash);

  return (
    <SwapFlow.StepLayout
      className="orbs_Success"
      title="Swap completed"
      body={
        <div className="flex w-full flex-col items-center gap-3">
          <div className="grid w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 rounded-[14px] border border-primary/25 bg-primary/10 p-3">
            <SwapSuccessToken field={Field.INPUT} />
            <ArrowRightIcon className="size-4 shrink-0 text-muted-foreground" />
            <SwapSuccessToken
              field={Field.OUTPUT}
              className="justify-end"
            />
          </div>
        </div>
      }
      footerLink={explorerUrl}
      footerText={explorerUrl ? t("viewOnExplorer") : undefined}
    />
  );
};

const SwapReviewContent = () => {
  const status = useBestTradeSwapStore((state) => state.status);
  const totalSteps = useBestTradeSwapStore((state) => state.totalSteps);
  const currentStepIndex = useBestTradeSwapStore(
    (state) => state.currentStepIndex,
  );
  const currentStep = useStep();
  const {
    inputAmountF,
    outputAmountF,
    inputCurrency,
    outputCurrency,
    inToken,
    outToken,
  } = useSwapFlowPreview();
  const tokenLogoClassName = status ? "size-[26px]" : "size-10";

  return (
    <DialogContent presentation="center">
      <DialogHeader>
        {!status && <DialogTitle>Review</DialogTitle>}
      </DialogHeader>
      <SwapFlow
        inAmount={inputAmountF}
        outAmount={outputAmountF}
        swapStatus={status}
        totalSteps={totalSteps}
        currentStep={currentStep}
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
          Success: <Success />,
          SuccessIcon: <SwapSuccessIcon />,
          Main: <Main />,
          Loader: <SwapFlowLoader />,
        }}
      />
    </DialogContent>
  );
};

const SubmitSwap = () => {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const { isLoadingTrade } = useDerivedSwap();
  const { setInputAmount } = useActionHandlers();
  const status = useBestTradeSwapStore((state) => state.status);
  const reset = useBestTradeSwapStore((state) => state.resetStore);

  const closeReview = useCallback(() => {
    setOpen(false);
    if (status === SwapStatus.SUCCESS) {
      setInputAmount("");
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
    if (status !== SwapStatus.LOADING) {
      reset();
    }
  }, [reset, setOpen, status]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <SubmitSwapButton
        onClick={onOpen}
        isLoading={isLoadingTrade}
        text={isLoadingTrade ? t("fetchingQuote") : "Submit Swap"}
      />
      <SwapReviewContent />
    </Dialog>
  );
};

const Main = () => {
  const t = useTranslations();
  const { inputAmount, outputAmount, inputCurrency, outputCurrency } =
    useDerivedSwap();
  const { status, onSwapBestTrade, isPreparing } = useSwapBestTrade();
  const inputUsd = useUSDPrice({
    token: inputCurrency?.address,
    amount: inputAmount,
  });
  const outputUsd = useUSDPrice({
    token: outputCurrency?.address,
    amount: outputAmount,
  });
  const inputUsdFormatted = useFormatNumber({ value: inputUsd.data });
  const outputUsdFormatted = useFormatNumber({ value: outputUsd.data });
  return (
    <>
      <SwapFlow.Main
        fromTitle={t("from")}
        toTitle={t("to")}
        inUsd={
          <p className="text-sm text-muted-foreground">${inputUsdFormatted}</p>
        }
        outUsd={
          <p className="text-sm text-muted-foreground">${outputUsdFormatted}</p>
        }
      />
      {!status && (
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

export function SwapBestTradeForm() {
  const t = useTranslations();
  const { inputCurrency, outputCurrency, inputAmount, outputAmount, isLoadingTrade, noLiquidity } =
    useDerivedSwap();
  const { setInputAmount, handleCurrencyChange } = useActionHandlers();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <CurrencyCard
          currency={inputCurrency}
          onCurrencyChange={(currency: string) =>
            handleCurrencyChange(currency, Field.INPUT)
          }
          onAmountChange={setInputAmount}
          amount={inputAmount}
          title={t("from")}
        />
        <ToggleCurrencies />
        <CurrencyCard
          currency={outputCurrency}
          onCurrencyChange={(currency: string) =>
            handleCurrencyChange(currency, Field.OUTPUT)
          }
          disabled={true}
          amount={formatDecimals(outputAmount, 6)}
          title={t("to")}
          isLoading={isLoadingTrade}
          statusText={noLiquidity ? t("noLiquidity") : undefined}
        />
      </div>
      <FormActionPanel>
        <SettingsModal triggerVariant="action" />
        <SubmitSwap />
      </FormActionPanel>
    </div>
  );
}
