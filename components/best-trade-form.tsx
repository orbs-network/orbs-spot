"use client";
import { CurrencyCard } from "./currency-card";
import { useSwapBestTrade } from "@/lib/hooks/use-swap-best-trade";
import { ToggleCurrencies } from "./toggle-currencies";
import { SubmitSwapButton } from "./submit-swap-button";
import { useDerivedSwap } from "@/lib/hooks/use-derived-swap";
import { useActionHandlers } from "@/lib/hooks/use-action-handlers";
import { Step, SwapFlow, SwapStatus, Token } from "@orbs-network/swap-ui";
import { useCallback, useMemo, useState } from "react";
import { useFormatNumber, useToAmountUI } from "@/lib/hooks/common";
import { useBestTradeSwapStore } from "@/lib/hooks/store";
import { Field, SwapStep } from "@/lib/types";
import { useUSDPrice } from "@/lib/hooks/use-usd-price";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import BN from "bignumber.js";
import { dynamicDecimals, getExplorerUrl } from "@/lib/utils";
import { useConnection } from "wagmi";
import { useTranslations } from "@/lib/use-translations";
import { SettingsModal } from "./settings-modal";
import { FormActionPanel } from "./form-action-panel";
import { SwapFlowLoader } from "./swap-flow-loader";
import { DetailRow } from "./ui/detail-row";
import { SwapFlowTokenLogo } from "./ui/swap-flow-token-logo";

const useStep = () => {
  const currentStep = useBestTradeSwapStore((state) => state.currentStep);
  return useMemo((): Step | undefined => {
    if (currentStep === SwapStep.WRAP) {
      return {
        title: "Wrap",
        footerText: "Wrap your tokens",
      };
    } else if (currentStep === SwapStep.APPROVE) {
      return {
        title: "Approve",
        footerText: "Approve your tokens",
      };
    } else if (currentStep === SwapStep.SWAP) {
      return {
        title: "Swap",
        footerText: "Swap your tokens",
      };
    }
    return undefined;
  }, [currentStep]);
};

const formatSafeFixed = (value: BN, decimals = 2) => {
  if (!value.isFinite() || value.isNaN()) return "0.00";
  return value.toFixed(decimals);
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
      value={`$${usd.formatted ?? "0"}`}
      labelClassName="font-medium text-foreground"
      valueClassName="font-normal text-foreground"
    />
  );
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
    <div className="flex flex-col gap-2 w-full mt-4 rounded-xl border border-primary/25 bg-primary/12 p-3">
      <NetworkCost />
      <PriceImpact />
      <MinimumAmountOut />
      <Rate />
    </div>
  );
};

const Success = () => {
  const t = useTranslations();
  const { txHash } = useSwapBestTrade();
  const { chainId } = useConnection();

  return (
    <SwapFlow.Success
      footerLink={getExplorerUrl(chainId, txHash)}
      footerText={t("viewOnExplorer")}
    />
  );
};

const SwapReviewContent = ({
  status,
  totalSteps,
  currentStepIndex,
  inputAmountF,
  outputAmountF,
  inToken,
  outToken,
}: {
  status?: SwapStatus;
  totalSteps?: number;
  currentStepIndex?: number;
  inputAmountF?: string;
  outputAmountF?: string;
  inToken: Token;
  outToken: Token;
}) => {
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
        currentStep={useStep()}
        currentStepIndex={currentStepIndex}
        inToken={inToken}
        outToken={outToken}
        components={{
          SrcTokenLogo: <SwapFlowTokenLogo token={inToken} />,
          DstTokenLogo: <SwapFlowTokenLogo token={outToken} />,
          Failed: <SwapFlow.Failed />,
          Success: <Success />,
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
  const {
    inputCurrency,
    outputCurrency,
    inputAmount,
    outputAmount,
    isLoadingTrade,
  } = useDerivedSwap();
  const { setInputAmount, } = useActionHandlers();
  const { status, totalSteps, currentStepIndex, reset } = useSwapBestTrade();
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <SubmitSwapButton
        onClick={onOpen}
        isLoading={isLoadingTrade}
        text={isLoadingTrade ? t("fetchingQuote") : "Submit Swap"}
      />
      <SwapReviewContent
        status={status}
        totalSteps={totalSteps}
        currentStepIndex={currentStepIndex}
        inputAmountF={inputAmountF}
        outputAmountF={outputAmountF}
        inToken={inToken}
        outToken={outToken}
      />
    </Dialog>
  );
};

const Main = () => {
  const t = useTranslations();
  const { inputAmount, outputAmount, inputCurrency, outputCurrency } =
    useDerivedSwap();
  const { status, onSwapBestTrade } = useSwapBestTrade();
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
        <div className="flex flex-col gap-2 w-full mt-3">
          <Details />
          <SubmitSwapButton
            onClick={onSwapBestTrade}
            isLoading={status === SwapStatus.LOADING}
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
          amount={outputAmount}
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
