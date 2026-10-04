"use client";
import { CurrencyCard } from "@/components/currency-card";
import { ToggleCurrencies } from "@/components/toggle-currencies";
import { useDerivedSwap } from "@/lib/hooks/use-derived-swap";
import { useActionHandlers } from "@/lib/hooks/use-action-handlers";
import { Field } from "@/lib/types";
import { useTranslations } from "@/lib/use-translations";
import { SettingsModal } from "@/components/settings-modal";
import { FormActionPanel } from "@/components/form-action-panel";
import { IS_ORBS } from "@/lib/partners/client";
import { LiquidityHubQuoteDeveloperTrigger } from "@developer-tools";
import { SubmitSwap } from "@/features/swap/review";

export function SwapBestTradeForm() {
  const t = useTranslations();
  const { inputCurrency, outputCurrency, inputAmount, outputAmount, isLoadingTrade, noLiquidity, quoteError, refetchTrade } =
    useDerivedSwap();
  const { setInputAmount, handleCurrencyChange } = useActionHandlers();

  return (
    <div className="flex flex-col gap-3">
      <div data-currency-pair className="flex flex-col gap-1.5">
        <CurrencyCard
          currency={inputCurrency}
          onCurrencyChange={(currency: string) =>
            handleCurrencyChange(currency, Field.INPUT)
          }
          onAmountChange={setInputAmount}
          amount={inputAmount}
          title={t("from")}
        />
        <ToggleCurrencies outputAmount={outputAmount} />
        <CurrencyCard
          currency={outputCurrency}
          onCurrencyChange={(currency: string) =>
            handleCurrencyChange(currency, Field.OUTPUT)
          }
          disabled={true}
          amount={outputAmount}
          title={t("to")}
          titleAction={<LiquidityHubQuoteDeveloperTrigger />}
          isLoading={isLoadingTrade}
          statusText={noLiquidity ? t("noLiquidity") : undefined}
        />
      </div>
      {quoteError && <div role="alert" className="flex items-center justify-between gap-3 border border-destructive/40 p-3 text-sm">
        <span>Could not load a quote. Try again.</span>
        <button type="button" className="shrink-0 text-primary underline focus-visible:outline-2 focus-visible:outline-primary" onClick={() => void refetchTrade()}>Retry quote</button>
      </div>}
      <FormActionPanel>
        {!IS_ORBS && <SettingsModal triggerVariant="action" />}
        <SubmitSwap />
      </FormActionPanel>
    </div>
  );
}
