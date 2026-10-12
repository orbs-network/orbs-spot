"use client";

import { usePriceDisplay, useTriggerPrice, useLimitPrice, useOrderModel } from "./use-order-form";

import BN from "bignumber.js";
import { CurrencySelector } from "@/components/currency-selector";
import { Button } from "@/components/ui/button";
import { FormLabel } from "@/components/ui/form-label";
import { FormNumberField } from "@/components/ui/form-number-field";
import { FormPanel } from "@/components/ui/form-panel";
import { NumericInput } from "@/components/ui/numeric-input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { TokenSelectorTrigger } from "@/components/ui/token-selector-trigger";
import { useActionHandlers } from "@/lib/hooks/use-action-handlers";
import { useCurrency } from "@/lib/hooks/use-currencies";
import { useCurrenciesQuery } from "@/lib/hooks/use-currencies-query";
import { useTranslations } from "@/lib/use-translations";
import { Currency, Field } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Module, type Token } from "@orbs-network/spot-ui";
import { ArrowLeftRightIcon, RotateCcwIcon } from "lucide-react";
import { useCallback, useId } from "react";
import styles from "./price-panels.module.css";
import { formatPriceInputError } from "./utils";

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
  const { isLoading: tokensLoading } = useCurrenciesQuery();
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
          isLoading={tokensLoading}
          symbol={token?.symbol}
          logoUrl={token?.logoUrl || currency?.logoUrl}
          className={cn(
            "-mx-1 gap-1.5 px-1 py-0.5 hover:bg-primary/8 ",
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
  error,
  inputLabel,
  inputName,
  token,
  value,
  onChange,
  percentage,
  onPercentageChange,
}: {
  error?: string;
  inputLabel: string;
  inputName: string;
  token?: Token;
  value: string;
  onChange: (value: string) => void;
  percentage: string;
  onPercentageChange: (value: string) => void;
}) {
  const errorId = useId();
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div data-spot-price-input data-invalid={Boolean(error)} className={styles.fields} role="group" aria-label={`${inputLabel} and market adjustment`}>
        <FormNumberField data-spot-price-value className={styles.rateField}>
          <div data-price-amount className={styles.amount}>
            <NumericInput
              error={error}
              aria-describedby={error ? errorId : undefined}
              aria-label={inputLabel}
              name={inputName}
              value={value}
              onChange={onChange}
              suffix={token?.symbol ? ` ${token.symbol}` : undefined}
              placeholder={token?.symbol ? `0 ${token.symbol}` : "0"}
              className="text-base font-semibold text-foreground"
            />
          </div>
        </FormNumberField>
        <FormNumberField className={styles.adjustmentField}>
          <NumericInput
            error={error}
            aria-describedby={error ? errorId : undefined}
            aria-label={`${inputLabel} adjustment percentage`}
            name={`${inputName}-percentage`}
            value={percentage}
            onChange={onPercentageChange}
            className="text-center text-base font-semibold"
            placeholder="+0%"
            suffix="%"
            showPositiveSign
            allowNegative
          />
        </FormNumberField>
      </div>
      {error && <p id={errorId} data-price-error role="alert" className="text-xs leading-relaxed text-destructive">{error}</p>}
    </div>
  );
}

function MarketRateSummary() {
  const { marketRate, displayInputToken, displayOutputToken } = usePriceDisplay();
  const { form, market } = useOrderModel();

  if (!BN(form.inputAmount.raw).gt(0)) return null;

  return (
    <div data-market-rate-summary role="group" aria-label="Market rate" className="min-w-0 text-right">
      {market.isLoading ? (
        <Skeleton role="status" aria-label="Loading market rate…" className="h-4 w-36 max-w-full" />
      ) : (
        <p className="min-w-0 text-xs wrap-anywhere text-muted-foreground">
          1 {displayInputToken?.symbol} = <span className="font-medium tabular-nums text-foreground"><span className="whitespace-nowrap">{marketRate || "—"}</span> {displayOutputToken?.symbol}</span>
        </p>
      )}
    </div>
  );
}

function PriceResetButton({ onClick, label = "Use market rate" }: { onClick: () => void; label?: string }) {
  const { marketRate } = usePriceDisplay();
  return (
    <button
      type="button"
      data-hover="text"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={!marketRate || marketRate === "0"}
      className={styles.marketAction}
    >
      <RotateCcwIcon aria-hidden="true" className="size-3.5" />
      <span>{label}</span>
    </button>
  );
}

function TriggerPricePanel({ orderModule }: { orderModule: Module }) {
  const t = useTranslations();
  const { displayInputToken, isInverted } = usePriceDisplay();
  const {
    inputValue: price,
    onInputChange,
    percentage,
    onPercentageChange,
    onReset,
    canReset,
    displayOutputToken: invertedDstToken,
    error,
  } = useTriggerPrice();

  if (orderModule !== Module.STOP_LOSS && orderModule !== Module.TAKE_PROFIT) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      <div data-spot-price-label className="flex min-h-8 min-w-0 items-center justify-between gap-2">
        <FormLabel
          className="min-w-0 gap-1"
          textClassName="min-w-0 text-xs"
          tooltipAriaLabel="Trigger price information"
          tooltip={`${t(
            orderModule === Module.STOP_LOSS
              ? "stopLossTooltip"
              : "takeProfitTooltip",
          )} ${t("triggerLimitRelationshipTooltip")}`}
        >
          Trigger <span className="font-normal whitespace-nowrap">(1 {displayInputToken?.symbol})</span>
        </FormLabel>
        {canReset && <PriceResetButton onClick={onReset} label="Use default" />}
      </div>
      <SpotPriceInput
        error={formatPriceInputError(error, isInverted, t)}
        inputLabel="Trigger price"
        inputName="trigger-price"
        token={invertedDstToken}
        value={price}
        onChange={(value) => onInputChange(value)}
        percentage={percentage}
        onPercentageChange={(value) => onPercentageChange(value)}
      />
    </div>
  );
}

function LimitPricePanel({ orderModule }: { orderModule: Module }) {
  const t = useTranslations();
  const { displayInputToken, isInverted } = usePriceDisplay();
  const {
    onInputChange,
    inputValue: priceUI,
    percentage,
    onPercentageChange,
    isEnabled: isLimitPrice,
    toggle: toggleLimitPrice,
    onReset,
    canReset,
    displayOutputToken: invertedDstToken,
    error,
  } = useLimitPrice();

  const isTrigger = orderModule === Module.STOP_LOSS || orderModule === Module.TAKE_PROFIT;
  const limitHelp = orderModule === Module.TWAP
    ? "The limit applies to every individual trade. Trades only fill at your limit rate or better. If the market moves beyond the limit, remaining trades can stay unfilled until conditions improve or the order expires. The order may expire partially filled."
    : isTrigger ? t("triggerLimitRelationshipTooltip") : t("limitPriceTooltip");
  const priceHelp = isLimitPrice ? limitHelp : `${limitHelp} The market rate is an indicative reference, not a guaranteed execution price. It may change before a trade executes.`;

  return (
    <div data-limit-price-panel className={cn("flex flex-col gap-2", isTrigger && "mt-2 border-t border-border/50 pt-5")}>
      <div data-spot-price-label className="flex min-h-8 min-w-0 items-center justify-between gap-2">
        <div className={cn("flex min-w-0 items-center gap-1.5", !isLimitPrice && "shrink-0")}>
        {orderModule !== Module.LIMIT && (
          <Switch
            checked={isLimitPrice}
            onCheckedChange={toggleLimitPrice}
            aria-label="Toggle limit price"
          />
        )}
          <FormLabel className="min-w-0 gap-1" textClassName="min-w-0 text-xs" tooltip={priceHelp} tooltipAriaLabel="Limit price information">
            Limit price {isLimitPrice && <span className="font-normal whitespace-nowrap">(1 {displayInputToken?.symbol})</span>}
          </FormLabel>
        </div>
        {isLimitPrice ? canReset && <PriceResetButton onClick={onReset} label={isTrigger ? "Use default" : "Use market rate"} /> : <MarketRateSummary />}
      </div>
      {isLimitPrice ? (
        <SpotPriceInput
          error={formatPriceInputError(error, isInverted, t)}
          inputLabel="Limit price"
          inputName="limit-price"
          token={invertedDstToken}
          value={priceUI}
          onChange={(value) => onInputChange(value)}
          percentage={percentage}
          onPercentageChange={(value) => onPercentageChange(value)}
        />
      ) : null}
    </div>
  );
}

function PricesHeader() {
  const { onInvert, inputToken, outputToken } = usePriceDisplay();

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-sm font-medium text-muted-foreground">
        <span>Sell</span>
        <PriceTokenSelector token={inputToken} field={Field.INPUT} logoClassName="size-4" fallbackClassName="text-[7px]" />
        <span>for</span>
        <span className="break-all text-foreground">{outputToken?.symbol ?? "Select token"}</span>
      </div>
      <Button variant="ghost" size="icon" onClick={onInvert} aria-label="Invert rate">
        <ArrowLeftRightIcon aria-hidden="true" className="size-4" />
      </Button>
    </div>
  );
}

export function PricesPanel({ orderModule }: { orderModule: Module }) {
  return (
    <FormPanel data-order-prices-panel className="flex flex-col gap-2">
      <PricesHeader />
      <TriggerPricePanel orderModule={orderModule} />
      <LimitPricePanel orderModule={orderModule} />
    </FormPanel>
  );
}
