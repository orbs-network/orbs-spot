"use client";
import { Currency } from "@/lib/types";
import { CurrencySelector } from "./currency-selector";
import { ChevronDownIcon } from "lucide-react";
import { NumericInput } from "./ui/numeric-input";
import { useBalance } from "@/lib/hooks/use-balances";
import { useCallback, useRef } from "react";
import BN from "bignumber.js";
import { formatDecimals } from "@/lib/utils";
import { USD } from "./ui/usd";
import { Balance } from "./ui/balance";
import { CurrencyLogo } from "./ui/currency-logo";

type Props = {
  currency?: Currency;
  onCurrencyChange: (currency: string) => void;
  onAmountChange?: (amount: string) => void;
  amount: string;
  disabled?: boolean;
  title?: string;
  isLoading?: boolean;
  statusText?: string;
};

const CurrencySelectorTrigger = ({ currency }: { currency?: Currency }) => {
  return (
    <div className="flex w-full cursor-pointer items-center gap-1 rounded-full border border-border/80 bg-card px-2 py-1.5 shadow-[0_6px_20px_rgba(0,0,0,0.16)] transition-colors hover:border-primary/70 hover:bg-secondary sm:w-[136px]">
      <CurrencyLogo currency={currency} className="size-7 shrink-0" />
      <p className="min-w-0 flex-1 truncate text-sm font-medium">
        {currency?.symbol}
      </p>
      <ChevronDownIcon className="size-4 shrink-0" />
    </div>
  );
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
      if(BN(balance).decimalPlaces(7).lte(0)) {
        onAmountChange("");
        return;
      }
      onAmountChange(
        formatDecimals(BN(balance).times(percentage).toString(), 8)
      );
    },
    [balance, onAmountChange]
  );
  
  return (
    <div className="mb-1 flex cursor-pointer flex-wrap items-center justify-start gap-1 sm:absolute sm:right-4 sm:top-4 sm:mb-0 sm:justify-end">
      {PERCENTAGE_BUTTONS.map((button) => (
        <div
          key={button.value}
          className="flex cursor-pointer items-center gap-1 rounded-xl border border-border/80 bg-card/80 px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/70 hover:bg-primary hover:text-primary-foreground sm:text-[12px]"
          onClick={() => onPercentageClick(button.value)}
        >
          {button.label}
        </div>
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
  isLoading = false,
  statusText,
}: Props) {
  const amountInputRef = useRef<HTMLInputElement>(null);

  const focusAmountInput = useCallback(() => {
    if (disabled) {
      return;
    }

    amountInputRef.current?.focus({ preventScroll: true });
  }, [disabled]);

  const focusAmountInputFromCardClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement | null;

      if (
        target?.closest("a, button, input, [role='button'], [data-no-card-focus]")
      ) {
        return;
      }

      focusAmountInput();
    },
    [focusAmountInput]
  );
  
  return (
    <div
      className="group relative flex min-w-0 flex-col gap-2 rounded-[22px] border border-border/70 bg-secondary/55 p-4 transition-colors hover:border-primary/35"
      onClick={focusAmountInputFromCardClick}
      onMouseEnter={focusAmountInput}
      onPointerEnter={focusAmountInput}
    >
      {!disabled && (
        <PercentageButtons
          onAmountChange={onAmountChange ?? (() => {})}
          currency={currency}
        />
      )}
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      <div
        className={`grid min-w-0 grid-cols-1 items-center gap-2 sm:grid-cols-[minmax(0,1fr)_auto] ${
          disabled ? "" : "mt-2 sm:mt-3"
        }`}
      >
        <NumericInput
          ref={amountInputRef}
          disabled={disabled}
          value={amount}
          onChange={onAmountChange ?? (() => {})}
          isLoading={isLoading}
          className="min-w-0 text-[34px] font-medium"
        />
        <CurrencySelector
          onCurrencyChange={(currency: Currency) =>
            onCurrencyChange(currency.address)
          }
          trigger={<CurrencySelectorTrigger currency={currency} />}
        />
      </div>
      <div className="flex min-w-0 flex-col items-start gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
        {statusText ? (
          <p className="truncate text-sm font-medium text-muted-foreground">
            {statusText}
          </p>
        ) : (
          <USD address={currency?.address} amount={amount} />
        )}
        <Balance
          currency={currency}
          onAmountChange={onAmountChange ?? (() => {})}
        />
      </div>
    </div>
  );
}
