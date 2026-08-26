"use client";

import { CurrencySelector } from "@/components/currency-selector";
import { Button } from "@/components/ui/button";
import { FormLabel } from "@/components/ui/form-label";
import { FormNumberField } from "@/components/ui/form-number-field";
import { FormPanel } from "@/components/ui/form-panel";
import { NumericInput } from "@/components/ui/numeric-input";
import { Switch } from "@/components/ui/switch";
import { TokenSelectorTrigger } from "@/components/ui/token-selector-trigger";
import { useActionHandlers } from "@/lib/hooks/use-action-handlers";
import { useFormatNumber } from "@/lib/hooks/common";
import { useCurrency } from "@/lib/hooks/use-currencies";
import { useTranslations } from "@/lib/use-translations";
import { Currency, Field } from "@/lib/types";
import { cn, formatDecimals } from "@/lib/utils";
import { Module, type Token, useSpot } from "@orbs-network/spot-react";
import { ArrowLeftRightIcon } from "lucide-react";
import { useCallback } from "react";

export function PriceTokenSelector({
  className,
  fallbackClassName,
  field,
  logoClassName,
  token,
}: {
  className?: string;
  fallbackClassName: string;
  field: Field;
  logoClassName: string;
  token?: Token;
}) {
  const currency = useCurrency(token?.address);
  const { handleCurrencyChange } = useActionHandlers();
  const onCurrencyChange = useCallback(
    (currency: Currency) => handleCurrencyChange(currency.address, field),
    [field, handleCurrencyChange],
  );

  return (
    <CurrencySelector
      onCurrencyChange={onCurrencyChange}
      trigger={
        <TokenSelectorTrigger
          aria-label="Select price token"
          currency={currency}
          symbol={token?.symbol}
          logoUrl={token?.logoUrl || currency?.logoUrl}
          className={cn(
            "-mx-1 gap-1.5 px-1 py-0.5 hover:bg-primary/8 hover:text-foreground",
            className,
          )}
          logoClassName={logoClassName}
          fallbackClassName={fallbackClassName}
        />
      }
    />
  );
}

function SpotPriceInput({
  inputLabel,
  inputName,
  token,
  tokenField,
  value,
  onChange,
  percentage,
  onPercentageChange,
  usd,
}: {
  inputLabel: string;
  inputName: string;
  token?: Token;
  tokenField: Field;
  value: string;
  onChange: (value: string) => void;
  percentage: string;
  onPercentageChange: (value: string) => void;
  usd?: string;
}) {
  const usdFormatted = useFormatNumber({ value: usd, decimalScale: 2 });

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_90px] gap-2">
      <FormNumberField
        className="flex min-w-0 items-center gap-3 rounded-[12px] border border-border/80 bg-transparent px-3 py-2 text-foreground transition-colors focus-within:border-primary"
      >
        <PriceTokenSelector
          token={token}
          field={tokenField}
          logoClassName="size-5"
          fallbackClassName="text-[8px]"
          className="text-base font-semibold text-foreground"
        />
        <div className="min-w-0 flex-1 text-right">
          <NumericInput
            aria-label={inputLabel}
            name={inputName}
            value={value}
            onChange={onChange}
            className="text-right text-[20px] font-semibold text-foreground"
          />
          <p className="text-sm text-muted-foreground">
            ${usdFormatted || "0"}
          </p>
        </div>
      </FormNumberField>
      <FormNumberField
        className="cursor-pointer rounded-[12px] border border-border/80 bg-transparent px-2 py-2 text-foreground transition-colors focus-within:border-primary"
      >
        <NumericInput
          aria-label={`${inputLabel} adjustment percentage`}
          name={`${inputName}-percentage`}
          value={percentage}
          onChange={onPercentageChange}
          className="text-center text-[18px] font-semibold text-foreground"
          placeholder="0.0%"
          suffix="%"
          allowNegative
        />
      </FormNumberField>
    </div>
  );
}

function PriceResetButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md text-sm font-semibold text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
    >
      Set to default
    </button>
  );
}

function TriggerPricePanel({ orderModule }: { orderModule: Module }) {
  const t = useTranslations();
  const { isInverted } = useSpot().pricePanel;
  const {
    priceUI: price,
    onInputChange,
    percentage,
    onPercentageChange,
    onReset,
    invertedDstToken,
    isTypedValue,
    usd,
  } = useSpot().triggerPricePanel;

  if (orderModule !== Module.STOP_LOSS && orderModule !== Module.TAKE_PROFIT) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <FormLabel
          tooltip={t(
            orderModule === Module.STOP_LOSS
              ? "stopLossTooltip"
              : "takeProfitTooltip",
          )}
        >
          {t("stopLossLabel")}
        </FormLabel>
        <PriceResetButton onClick={onReset} />
      </div>
      <SpotPriceInput
        inputLabel="Trigger price"
        inputName="trigger-price"
        token={invertedDstToken}
        tokenField={isInverted ? Field.INPUT : Field.OUTPUT}
        value={isTypedValue ? price : formatDecimals(price, 6)}
        onChange={(value) => onInputChange(value)}
        percentage={percentage}
        onPercentageChange={(value) => onPercentageChange(value)}
        usd={usd}
      />
    </div>
  );
}

function LimitPricePanel({ orderModule }: { orderModule: Module }) {
  const t = useTranslations();
  const { isInverted } = useSpot().pricePanel;
  const {
    onInputChange,
    priceUI,
    percentage,
    onPercentageChange,
    isLimitPrice,
    toggleLimitPrice,
    onReset,
    invertedDstToken,
    isTypedValue,
    usd,
  } = useSpot().limitPricePanel;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        {orderModule !== Module.LIMIT && (
          <Switch
            checked={isLimitPrice}
            onCheckedChange={toggleLimitPrice}
            aria-label="Toggle limit price"
          />
        )}
        <div className="flex flex-1 items-center justify-between gap-3">
          <FormLabel tooltip={t("limitPriceTooltip")}>
            {t("limitPrice")}
          </FormLabel>
          {isLimitPrice && <PriceResetButton onClick={onReset} />}
        </div>
      </div>
      {isLimitPrice && (
        <SpotPriceInput
          inputLabel="Limit price"
          inputName="limit-price"
          token={invertedDstToken}
          tokenField={isInverted ? Field.INPUT : Field.OUTPUT}
          value={isTypedValue ? priceUI : formatDecimals(priceUI, 6)}
          onChange={(value) => onInputChange(value)}
          percentage={percentage}
          onPercentageChange={(value) => onPercentageChange(value)}
          usd={usd}
        />
      )}
    </div>
  );
}

function PricesHeader() {
  const { onInvert, isInverted, fromToken, isMarketPrice } =
    useSpot().pricePanel;
  const fromTokenField = isInverted ? Field.OUTPUT : Field.INPUT;

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-muted-foreground">
        <span>{isInverted ? "Buy" : "Sell"}</span>
        <PriceTokenSelector
          token={fromToken}
          field={fromTokenField}
          logoClassName="size-4"
          fallbackClassName="text-[7px]"
        />
        <span className="shrink-0">
          {isMarketPrice ? "at best rate" : "at rate"}
        </span>
      </div>
      {!isMarketPrice && (
        <Button
          variant="secondary"
          size="icon"
          className="rounded-2xl"
          onClick={onInvert}
          aria-label="Invert rate"
        >
          <ArrowLeftRightIcon aria-hidden="true" className="size-4" />
        </Button>
      )}
    </div>
  );
}

export function PricesPanel({ orderModule }: { orderModule: Module }) {
  return (
    <FormPanel className="flex flex-col gap-4">
      <PricesHeader />
      <TriggerPricePanel orderModule={orderModule} />
      <LimitPricePanel orderModule={orderModule} />
    </FormPanel>
  );
}
