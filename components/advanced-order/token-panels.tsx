"use client";

import { useOutputAmount, useTrades, useDuration, useFillDelay, useOrderForm } from "./use-order-form";

import { CurrencyCard } from "@/components/currency-card";
import { FormLabel } from "@/components/ui/form-label";
import { FormNumberField } from "@/components/ui/form-number-field";
import { FormPanel } from "@/components/ui/form-panel";
import { NumericInput } from "@/components/ui/numeric-input";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MinusIcon, PlusIcon } from "lucide-react";
import { StyledSelect } from "@/components/ui/styled-select";
import { useActionHandlers } from "@/lib/hooks/use-action-handlers";
import { useDerivedSwap } from "@/lib/hooks/use-derived-swap";
import { useTranslations } from "@/lib/use-translations";
import { Field } from "@/lib/types";
import { displayTokenAmount } from "@/lib/token-display";
import { Module, type InputError } from "@orbs-network/spot-ui";
import { type ReactNode, useCallback } from "react";
import { DURATION_OPTIONS } from "./constants";
import { formatInputError } from "./utils";
import styles from "./time-input.module.css";

export function TokenPanel({ isSource }: { isSource: boolean }) {
  const t = useTranslations();
  const { inputCurrency, outputCurrency, inputAmount } = useDerivedSwap();
  const { amount: { ui: dstAmount }, isLoading } = useOutputAmount();
  const { handleCurrencyChange, setInputAmount } = useActionHandlers();
  const { errors, values } = useOrderForm();

  const onTokenChange = useCallback(
    (currency: string) => {
      handleCurrencyChange(currency, isSource ? Field.INPUT : Field.OUTPUT);
    },
    [handleCurrencyChange, isSource],
  );

  return (
    <CurrencyCard
      error={isSource ? formatInputError(errors.balance ?? errors.minTradeSize, t) : undefined}
      currency={isSource ? inputCurrency : outputCurrency}
      onCurrencyChange={onTokenChange}
      onAmountChange={isSource ? setInputAmount : undefined}
      amount={isSource ? inputAmount : displayTokenAmount(dstAmount, outputCurrency?.symbol, outputCurrency?.decimals)}
      title={isSource ? t("from") : values.isMarketOrder ? "Estimated receive" : "To (est.)"}
      disabled={!isSource}
      isLoading={!isSource && Boolean(isLoading)}
    />
  );
}

function OrderNumericInputPanel<TUnit extends number>({
  decimalScale = 0,
  disabledReason,
  error,
  inputLabel,
  inputName,
  onChange,
  title,
  tooltip,
  unit,
  unitOptions,
  unitSelectLabel,
  onUnitChange,
  value,
}: {
  decimalScale?: number;
  disabledReason?: string;
  error?: InputError;
  inputLabel: string;
  inputName: string;
  onChange: (value: string) => void;
  title: ReactNode;
  tooltip?: string;
  unit?: TUnit;
  unitOptions?: readonly { text: string; value: TUnit }[];
  unitSelectLabel?: string;
  onUnitChange?: (value: TUnit) => void;
  value?: string;
}) {
  const t = useTranslations();
  const errorMessage = formatInputError(error, t);
  const hasUnitSelect = unit !== undefined && unitOptions && onUnitChange;

  return (
    <FormPanel
      variant="muted"
      className="relative flex flex-col justify-between gap-3"
    >
      <fieldset disabled={Boolean(disabledReason)} className="m-0 flex min-w-0 flex-col gap-3 border-0 p-0 disabled:pointer-events-none disabled:opacity-40">
        <div data-order-input-heading className="flex items-start justify-between gap-4">
          <FormLabel tooltip={tooltip}>{title}</FormLabel>
        </div>
        <div data-order-input-controls data-time-input={hasUnitSelect ? "" : undefined} data-invalid={Boolean(errorMessage)} role={hasUnitSelect ? "group" : undefined} aria-label={hasUnitSelect ? inputLabel : undefined} className={`flex items-stretch gap-3 ${hasUnitSelect ? styles.control : ""}`}>
          <FormNumberField className="h-13 min-w-0 flex-1">
            <NumericInput
              error={errorMessage}
              aria-label={inputLabel}
              name={inputName}
              value={value ?? ""}
              onChange={onChange}
              disabled={Boolean(disabledReason)}
              decimalScale={decimalScale}
              className="text-[20px] font-semibold"
            />
          </FormNumberField>
          {hasUnitSelect ? (
            <div data-order-input-unit className="w-[132px] shrink-0 self-stretch">
              <StyledSelect
                error={errorMessage}
                aria-label={unitSelectLabel ?? `${inputLabel} unit`}
                value={unit}
                options={unitOptions.map((option) => ({
                  label: option.text,
                  value: option.value,
                }))}
                onValueChange={onUnitChange}
              />
            </div>
          ) : null}
        </div>
      </fieldset>
      {disabledReason && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="Why time between trades is disabled"
              className="absolute inset-0 cursor-help rounded-[inherit] bg-transparent! focus-visible:outline-2 focus-visible:outline-primary"
            />
          </TooltipTrigger>
          <TooltipContent>{disabledReason}</TooltipContent>
        </Tooltip>
      )}
    </FormPanel>
  );
}

function TradesPanel() {
  const t = useTranslations();
  const { inputAmount } = useOrderForm();
  const { totalTrades, maxTrades, onChange, error } = useTrades();
  const count = Math.max(1, totalTrades || 1);
  const maximum = Math.max(1, Math.floor(maxTrades || 1));
  const canSetMaximum = !inputAmount.isEmpty && Number(inputAmount.usd) > 0 && Number.isFinite(maxTrades);
  const atMinimum = count <= 1;
  const errorMessage = formatInputError(error, t);

  return (
    <FormPanel data-trades-panel variant="muted" className="flex flex-col justify-between gap-3">
      <div data-order-input-heading className="flex items-start justify-between gap-4">
        <FormLabel tooltip={`${t("totalTradesTooltip")} Max selects up to ${maximum} trades based on this order's value and the configured minimum trade size. More trades increase total network costs.`}>Total trades</FormLabel>
        <button
          type="button"
          data-hover="text"
          aria-label={`Set maximum trades (${maximum})`}
          disabled={!canSetMaximum || count === maximum}
          onClick={() => onChange(maximum)}
          className="min-h-8 shrink-0 cursor-pointer rounded text-xs font-semibold text-primary underline underline-offset-3 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-40 disabled:no-underline"
        >Max</button>
      </div>
      <div data-order-input-controls role="group" aria-label="Adjust total trades">
        <FormNumberField data-trade-count-control className="h-12 w-full gap-0 px-0!">
          <Tooltip action={!atMinimum} open={atMinimum ? undefined : false}>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-11 w-11 text-foreground aria-disabled:cursor-help aria-disabled:bg-transparent! aria-disabled:text-muted-foreground aria-disabled:opacity-30" aria-label="Decrease total trades" aria-disabled={atMinimum} onClick={() => {
                // Keep the unavailable action focusable so its explanation works on keyboard and touch.
                if (!atMinimum) onChange(count - 1);
              }}>
                <MinusIcon aria-hidden="true" className="size-4" />
              </Button>
            </TooltipTrigger>
            {atMinimum && <TooltipContent>Minimum 1 trade. An order must contain at least one trade.</TooltipContent>}
          </Tooltip>
          <NumericInput
            error={errorMessage}
            aria-label="Total trades"
            name="number-of-trades"
            value={totalTrades ? totalTrades.toString() : ""}
            onChange={value => onChange(Number(value || 0))}
            decimalScale={0}
            maxValue={maximum}
            className="min-w-0 flex-1 text-center text-base font-semibold"
          />
          <Button variant="ghost" size="icon" className="h-11 w-11 text-foreground disabled:text-muted-foreground disabled:opacity-30" aria-label="Increase total trades" disabled={count >= maximum} onClick={() => onChange(Math.min(maximum, count + 1))}>
            <PlusIcon aria-hidden="true" className="size-4" />
          </Button>
        </FormNumberField>
      </div>
    </FormPanel>
  );
}

function TimeInputPanel({ kind, disabledReason }: { kind: "duration" | "fillDelay"; disabledReason?: string }) {
  const t = useTranslations();
  const durationPanel = useDuration();
  const fillDelayPanel = useFillDelay();

  return (
    <OrderNumericInputPanel
      disabledReason={disabledReason}
      title={kind === "duration" ? t("expiry") : t("tradeIntervalTitle")}
      inputLabel={kind === "duration" ? "Order duration" : "Time between trades"}
      inputName={kind === "duration" ? "order-duration" : "trade-interval"}
      tooltip={
        kind === "duration" ? t("maxDurationTooltip") : t("tradeIntervalTooltip")
      }
      value={
        kind === "duration"
          ? durationPanel.duration.value?.toString() || ""
          : fillDelayPanel.fillDelay.value?.toString() || ""
      }
      onChange={
        kind === "duration"
          ? durationPanel.onInputChange
          : fillDelayPanel.onInputChange
      }
      unit={
        kind === "duration"
          ? durationPanel.duration.unit
          : fillDelayPanel.fillDelay.unit
      }
      unitOptions={DURATION_OPTIONS}
      unitSelectLabel={kind === "duration" ? "Duration unit" : "Interval unit"}
      onUnitChange={
        kind === "duration"
          ? durationPanel.onUnitSelect
          : fillDelayPanel.onUnitSelect
      }
      error={kind === "duration" ? durationPanel.error : fillDelayPanel.error}
    />
  );
}

export function ModuleInputs({ orderModule }: { orderModule: Module }) {
  const { schedule } = useOrderForm();

  if (orderModule === Module.TWAP) {
    return (
      <div data-twap-schedule className="contents">
        <TradesPanel />
        <TimeInputPanel
          kind="fillDelay"
          disabledReason={schedule.totalTrades === 1 ? "Time between trades only applies when there are two or more trades. This order executes once. Increase Total trades to set an interval." : undefined}
        />
      </div>
    );
  }

  return <TimeInputPanel kind="duration" />;
}
