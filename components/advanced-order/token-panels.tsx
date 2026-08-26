"use client";

import { CurrencyCard } from "@/components/currency-card";
import { FormLabel } from "@/components/ui/form-label";
import { FormNumberField } from "@/components/ui/form-number-field";
import { FormPanel } from "@/components/ui/form-panel";
import { NumericInput } from "@/components/ui/numeric-input";
import { StyledSelect } from "@/components/ui/styled-select";
import { useActionHandlers } from "@/lib/hooks/use-action-handlers";
import { useFormatNumber } from "@/lib/hooks/common";
import { useDerivedSwap } from "@/lib/hooks/use-derived-swap";
import { useTranslations } from "@/lib/use-translations";
import { Field } from "@/lib/types";
import { cn, formatDecimals } from "@/lib/utils";
import { Module, useSpot } from "@orbs-network/spot-react";
import { type ReactNode, useCallback, useMemo } from "react";
import { DURATION_OPTIONS } from "./constants";

export function TokenPanel({ isSource }: { isSource: boolean }) {
  const t = useTranslations();
  const { inputCurrency, outputCurrency, inputAmount } = useDerivedSwap();
  const { value: dstAmount, isLoading } = useSpot().dstTokenPanel;
  const { handleCurrencyChange, setInputAmount } = useActionHandlers();

  const onTokenChange = useCallback(
    (currency: string) => {
      handleCurrencyChange(currency, isSource ? Field.INPUT : Field.OUTPUT);
    },
    [handleCurrencyChange, isSource],
  );

  return (
    <CurrencyCard
      currency={isSource ? inputCurrency : outputCurrency}
      onCurrencyChange={onTokenChange}
      onAmountChange={isSource ? setInputAmount : undefined}
      amount={isSource ? inputAmount : formatDecimals(dstAmount, 6)}
      title={isSource ? t("from") : t("to")}
      disabled={!isSource}
      isLoading={!isSource && Boolean(isLoading)}
    />
  );
}

function OrderNumericInputPanel<TUnit extends number>({
  decimalScale = 0,
  error,
  inputLabel,
  inputName,
  onChange,
  rightHint,
  staticUnitLabel,
  title,
  tooltip,
  unit,
  unitOptions,
  unitSelectLabel,
  onUnitChange,
  value,
}: {
  decimalScale?: number;
  error?: unknown;
  inputLabel: string;
  inputName: string;
  onChange: (value: string) => void;
  rightHint?: ReactNode;
  staticUnitLabel?: string;
  title: ReactNode;
  tooltip?: string;
  unit?: TUnit;
  unitOptions?: readonly { text: string; value: TUnit }[];
  unitSelectLabel?: string;
  onUnitChange?: (value: TUnit) => void;
  value?: string;
}) {
  const hasUnitSelect = unit !== undefined && unitOptions && onUnitChange;

  return (
    <FormPanel
      variant="muted"
      className={cn(
        "flex flex-col justify-between gap-3",
        Boolean(error) && "border-destructive/70",
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <FormLabel tooltip={tooltip}>{title}</FormLabel>
        {rightHint ? (
          <p className="text-right text-sm font-medium text-foreground/80">
            {rightHint}
          </p>
        ) : null}
      </div>
      <div className="flex items-stretch gap-3">
        <FormNumberField className="h-13 min-w-0 flex-1">
          <NumericInput
            aria-label={inputLabel}
            name={inputName}
            value={value ?? ""}
            onChange={onChange}
            decimalScale={decimalScale}
            className="text-[20px] font-semibold"
          />
        </FormNumberField>
        {hasUnitSelect ? (
          <div className="w-[132px] shrink-0 self-stretch">
            <StyledSelect
              aria-label={unitSelectLabel ?? `${inputLabel} unit`}
              value={unit}
              options={unitOptions.map((option) => ({
                label: option.text,
                value: option.value,
              }))}
              onValueChange={onUnitChange}
            />
          </div>
        ) : staticUnitLabel ? (
          <p className="mt-auto mb-2 text-sm font-medium text-muted-foreground">{staticUnitLabel}</p>
        ) : null}
      </div>
    </FormPanel>
  );
}

function TradesPanel() {
  const t = useTranslations();
  const {
    totalTrades,
    onChange,
    amountPerTradeUI,
    amountPerTradeUsd,
    error,
    fromToken,
  } = useSpot().tradesAmountPanel;
  const amountPerTrade = useFormatNumber({ value: amountPerTradeUI });
  const amountPerTradeUsdFormatted = useFormatNumber({
    value: amountPerTradeUsd,
    decimalScale: 2,
  });
  const perTradeText = useMemo(() => {
    if (!fromToken || totalTrades === 1) return null;

    return (
      <>
        {amountPerTrade} {fromToken.symbol} per trade{" "}
        {amountPerTradeUsd && (
          <span className="text-xs text-foreground/50">
            (${amountPerTradeUsdFormatted})
          </span>
        )}
      </>
    );
  }, [
    amountPerTrade,
    amountPerTradeUsd,
    amountPerTradeUsdFormatted,
    fromToken,
    totalTrades,
  ]);

  return (
    <OrderNumericInputPanel
      title={t("tradesAmountTitle")}
      inputLabel="Number of trades"
      inputName="number-of-trades"
      tooltip={t("totalTradesTooltip")}
      value={totalTrades ? totalTrades.toString() : ""}
      onChange={(value) => onChange(Number(value || 0))}
      rightHint={perTradeText}
      staticUnitLabel="Trades"
      error={error}
    />
  );
}

function TimeInputPanel({ kind }: { kind: "duration" | "fillDelay" }) {
  const t = useTranslations();
  const durationPanel = useSpot().durationPanel;
  const fillDelayPanel = useSpot().fillDelayPanel;

  return (
    <OrderNumericInputPanel
      title={kind === "duration" ? t("expiry") : t("tradeIntervalTitle")}
      inputLabel={kind === "duration" ? "Order duration" : "Trade interval"}
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
  if (orderModule === Module.TWAP) {
    return (
      <>
        <TradesPanel />
        <TimeInputPanel kind="fillDelay" />
      </>
    );
  }

  return <TimeInputPanel kind="duration" />;
}
