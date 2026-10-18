"use client";

import { usePriceDisplay, useTriggerPrice, useLimitPrice } from "./use-order-form";

import { FormLabel, InfoTooltip } from "@/components/ui/form-label";
import { FormNumberField } from "@/components/ui/form-number-field";
import { FormPanel } from "@/components/ui/form-panel";
import { NumericInput } from "@/components/ui/numeric-input";
import { Switch } from "@/components/ui/switch";
import { useTranslations } from "@/lib/use-translations";
import { cn } from "@/lib/utils";
import { Module, type Token } from "@orbs-network/spot-ui";
import { ArrowLeftRightIcon, RotateCcwIcon } from "lucide-react";
import { useId } from "react";
import { numericFormatter } from "react-number-format";
import styles from "./price-panels.module.css";
import { formatPriceInputError } from "./utils";
import BN from "bignumber.js";

function SpotPriceInput({
  descriptionId,
  error,
  inputLabel,
  inputName,
  token,
  value,
  onChange,
  percentage,
  onPercentageChange,
}: {
  descriptionId?: string;
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
  const unitId = `${errorId}-unit`;
  const percentageHelpId = `${errorId}-percentage-help`;
  const { marketRate } = usePriceDisplay();
  const hasMarketRate = BN(marketRate).gt(0);
  const change = BN(percentage || "0");
  const percentageError = change.isFinite() && change.lte(-100) ? "Enter a percentage greater than -100%." : error;
  const percentageHelp = hasMarketRate
    ? "Edit the percentage relative to the current market price. Positive values are above market; negative values are below. The comparison follows the displayed token pair."
    : "Current market price unavailable.";
  const measuredAmount = numericFormatter(value || "0", {
    thousandSeparator: ",", decimalSeparator: ".", decimalScale: 18,
  });
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div data-spot-price-input data-invalid={Boolean(percentageError)} className={styles.fields} role="group" aria-label={`${inputLabel} and market adjustment`}>
        <FormNumberField data-spot-price-value className={styles.rateField}>
          <div data-price-amount className={styles.amount}>
            <span className={styles.amountInput}>
              <span aria-hidden="true" className={styles.amountMeasure}>{measuredAmount}</span>
              <NumericInput
                error={error}
                aria-describedby={[token?.symbol ? unitId : undefined, descriptionId, error ? errorId : undefined].filter(Boolean).join(" ") || undefined}
                aria-label={inputLabel}
                name={inputName}
                value={value}
                onChange={onChange}
                placeholder="0"
                className="text-base font-semibold text-foreground"
              />
            </span>
            {token?.symbol && <span id={unitId} title={token.symbol} className={styles.symbol}>{token.symbol}</span>}
          </div>
        </FormNumberField>
        <FormNumberField className={styles.adjustmentField} title={percentageHelp}>
          <NumericInput
            error={percentageError}
            aria-describedby={[percentageHelpId, descriptionId, percentageError ? errorId : undefined].filter(Boolean).join(" ")}
            aria-label={`${inputLabel} adjustment percentage`}
            name={`${inputName}-percentage`}
            value={hasMarketRate ? percentage : ""}
            disabled={!hasMarketRate}
            onChange={onPercentageChange}
            className="text-center text-base font-semibold"
            placeholder={hasMarketRate ? "+0%" : "—"}
            suffix="%"
            showPositiveSign
            allowNegative
          />
        </FormNumberField>
      </div>
      <span id={percentageHelpId} className="sr-only">{percentageHelp}</span>
      {percentageError && <p id={errorId} data-price-error role="alert" className="text-xs leading-relaxed text-destructive">{percentageError}</p>}
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

function PriceInvertButton() {
  const { displayInputToken, displayOutputToken, isInverted, onInvert } = usePriceDisplay();
  return <button
    type="button"
    aria-label="Invert price"
    aria-pressed={isInverted}
    title={`Show ${displayInputToken?.symbol ?? "input token"} per ${displayOutputToken?.symbol ?? "output token"}`}
    onClick={onInvert}
    disabled={!displayInputToken || !displayOutputToken}
    className={cn(styles.marketAction, "min-w-8")}
  >
    <ArrowLeftRightIcon aria-hidden="true" className="size-3.5" />
  </button>;
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
  const activatesBelow = (orderModule === Module.STOP_LOSS) !== isInverted;
  const activationHelp = `Activates at or ${activatesBelow ? "below" : "above"} this price.`;

  return (
    <div className="flex flex-col gap-1">
      <div data-spot-price-label className="flex min-h-7 min-w-0 flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <FormLabel
          className="min-w-0 gap-1"
          textClassName="min-w-0 text-xs text-foreground"
          tooltipAriaLabel="Trigger price information"
          tooltip={`${activationHelp} ${t(
            orderModule === Module.STOP_LOSS
              ? "stopLossTooltip"
              : "takeProfitTooltip",
          )} ${t("triggerLimitRelationshipTooltip")}`}
        >
          Trigger price <span className="font-normal whitespace-nowrap text-muted-foreground">(per 1 {displayInputToken?.symbol ?? "token"})</span>
        </FormLabel>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          {canReset && <PriceResetButton onClick={onReset} label="Use default" />}
          <PriceInvertButton />
        </div>
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
  const toggleId = useId();
  const descriptionId = `${toggleId}-description`;
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
  const isOptional = orderModule !== Module.LIMIT;
  const limitHelp = orderModule === Module.TWAP
    ? "The limit applies to every individual trade. Trades only fill at your limit rate or better. If the market moves beyond the limit, remaining trades can stay unfilled until conditions improve or the order expires. The order may expire partially filled."
    : isTrigger ? t("triggerLimitRelationshipTooltip") : t("limitPriceTooltip");
  const priceHelp = isLimitPrice ? limitHelp : `${limitHelp} The market rate is an indicative reference, not a guaranteed execution price. It may change before a trade executes.`;
  const modeDescription = isLimitPrice
    ? orderModule === Module.TWAP ? "Each trade executes only at your limit price or better." : "Once triggered, execute only at your limit price or better."
    : orderModule === Module.TWAP ? "Each trade uses the current market price." : "Once triggered, execute at the current market price.";

  return (
    <div data-limit-price-panel className={cn("flex flex-col gap-1.5", isTrigger && "mt-1")}>
      {isOptional && (
        <div data-limit-price-setting className={cn(styles.limitMode, isTrigger && styles.triggerLimitMode)}>
          <div className={styles.limitModeCopy}>
            <div className="flex min-w-0 items-center gap-1.5">
              <label htmlFor={toggleId} className="cursor-pointer text-sm font-medium text-foreground">Set a limit price</label>
              <InfoTooltip tooltip={priceHelp} ariaLabel="Limit price information" iconClassName="size-3.5" />
            </div>
            <label id={descriptionId} htmlFor={toggleId} className={styles.limitModeHint}>{modeDescription}</label>
          </div>
          <Switch
            id={toggleId}
            checked={isLimitPrice}
            onCheckedChange={toggleLimitPrice}
            aria-label="Set a limit price"
            aria-describedby={descriptionId}
            className={styles.limitSwitch}
          />
        </div>
      )}
      {isLimitPrice && (
        <div data-spot-price-label className="flex min-h-7 min-w-0 flex-wrap items-center justify-between gap-x-2 gap-y-1">
          <FormLabel className="min-w-0 gap-1" textClassName="min-w-0 text-xs" tooltip={isOptional ? undefined : priceHelp} tooltipAriaLabel="Limit price information">
            Limit price <span className="font-normal whitespace-nowrap">(per 1 {displayInputToken?.symbol ?? "token"})</span>
          </FormLabel>
          <div className="ml-auto flex shrink-0 items-center gap-1">
            {canReset && <PriceResetButton onClick={onReset} label={isTrigger ? "Use default" : "Use market rate"} />}
            {!isTrigger && <PriceInvertButton />}
          </div>
        </div>
      )}
      {isLimitPrice ? (
        <SpotPriceInput
          descriptionId={isOptional ? descriptionId : undefined}
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

export function PricesPanel({ orderModule }: { orderModule: Module }) {
  return (
    <FormPanel data-order-prices-panel className="flex flex-col gap-1.5">
      <TriggerPricePanel orderModule={orderModule} />
      <LimitPricePanel orderModule={orderModule} />
    </FormPanel>
  );
}
