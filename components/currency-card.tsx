"use client";
import type { Currency } from "@/lib/types";
import { CurrencySelector } from "./currency-selector";
import { NumericInput } from "./ui/numeric-input";
import { useBalance } from "@/lib/hooks/use-balances";
import { type ReactNode, useCallback } from "react";
import BN from "bignumber.js";
import { USD } from "./ui/usd";
import { Balance } from "./ui/balance";
import { TokenSelectorTrigger } from "./ui/token-selector-trigger";
import { FormPanel } from "./ui/form-panel";
import { useCurrenciesQuery } from "@/lib/hooks/use-currencies-query";

type Props = {
  currency?: Currency;
  onCurrencyChange: (currency: string) => void;
  onAmountChange?: (amount: string) => void;
  amount: string;
  disabled?: boolean;
  title?: string;
  titleAction?: ReactNode;
  isLoading?: boolean;
  statusText?: string;
};

const PERCENTAGE_BUTTONS = [
  {
    label: "25%",
    value: 0.25,
  },
  {
    label: "50%",
    value: 0.5,
  },
  {
    label: "75%",
    value: 0.75,
  },
  {
    label: "100%",
    value: 1,
  },
];

const PercentageButtons = ({
  onAmountChange,
  currency,
}: {
  currency?: Currency;
  onAmountChange: (amount: string) => void;
}) => {
  const { ui: balance } = useBalance(currency);
  const onPercentageClick = useCallback(
    (percentage: number) => {
      if (!BN(balance).isFinite() || BN(balance).lte(0)) {
        onAmountChange("");
        return;
      }
      onAmountChange(
        BN(balance).times(percentage).decimalPlaces(currency?.decimals ?? 18, BN.ROUND_DOWN).toFixed(),
      );
    },
    [balance, currency?.decimals, onAmountChange],
  );

  return (
    <div data-percentage-controls className="absolute right-4 top-4 flex flex-wrap items-center justify-end gap-1">
      {PERCENTAGE_BUTTONS.map((button) => (
        <button
          type="button"
          data-percentage-button
          key={button.value}
          className="flex cursor-pointer items-center gap-1 rounded-xl border border-border/80 bg-card/80 px-2.5 py-1 text-[13px] font-medium text-muted-foreground transition-colors hover:border-primary/35 hover:bg-primary/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 sm:text-sm"
          onClick={() => onPercentageClick(button.value)}
          aria-label={`Use ${button.label} of available balance`}
        >
          {button.label}
        </button>
      ))}
    </div>
  );
};

export function CurrencyCard({
  currency,
  onCurrencyChange,
  onAmountChange,
  disabled,
  amount,
  title,
  titleAction,
  isLoading = false,
  statusText,
}: Props) {
  const { isLoading: tokensLoading } = useCurrenciesQuery();

  return (
    <FormPanel data-currency-card className="group relative flex min-w-0 flex-col gap-2 bg-secondary/55 transition-colors hover:border-primary/35">
      <div data-currency-card-header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          {titleAction}
        </div>
        {!disabled && onAmountChange && <PercentageButtons onAmountChange={onAmountChange} currency={currency} />}
      </div>
      <div
        data-currency-amount-row
        className={`grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 ${
          disabled ? "" : "mt-2 sm:mt-3"
        }`}
      >
        <NumericInput
          aria-label={`${title ?? (disabled ? "To" : "From")} amount`}
          name={disabled ? "destination-amount" : "source-amount"}
          disabled={disabled}
          decimalScale={currency?.decimals ?? 18}
          value={amount}
          onChange={onAmountChange ?? (() => {})}
          isLoading={isLoading}
          className="min-w-0 text-[30px] font-medium leading-none"
        />
        <CurrencySelector
          onCurrencyChange={(currency: Currency) =>
            onCurrencyChange(currency.address)
          }
          trigger={
            <TokenSelectorTrigger
              aria-label={`Select ${title ?? (disabled ? "destination" : "source")} token`}
              currency={currency}
              isLoading={tokensLoading}
              showChevron
              className="gap-1 border border-border/80 bg-card px-2 py-1.5 hover:border-primary/25 hover:bg-secondary/45"
              logoClassName="mr-1 size-7"
              symbolClassName="relative top-[-1px] flex-1 text-[14px] font-medium"
            />
          }
        />
      </div>
      <div data-currency-value-row className="flex min-w-0 items-center justify-between gap-2">
        {statusText ? (
          <p className="truncate text-sm font-medium text-muted-foreground">
            {statusText}
          </p>
        ) : (
          <USD address={currency?.address} amount={amount} />
        )}
        <Balance currency={currency} onAmountChange={onAmountChange} />
      </div>
    </FormPanel>
  );
}
