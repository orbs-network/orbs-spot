"use client";
import { Currency } from "@/lib/types";
import { CurrencySelector } from "./currency-selector";
import { NumericInput } from "./ui/numeric-input";
import { useBalance } from "@/lib/hooks/use-balances";
import { useCallback, useRef } from "react";
import BN from "bignumber.js";
import { formatDecimals } from "@/lib/utils";
import { USD } from "./ui/usd";
import { Balance } from "./ui/balance";
import { TokenSelectorTrigger } from "./ui/token-selector-trigger";
import { FormPanel } from "./ui/form-panel";

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
    <TokenSelectorTrigger
      currency={currency}
      showChevron
      className="gap-1 border border-border/80 bg-card px-2 py-1.5 hover:border-primary/25 hover:bg-secondary/45"
      logoClassName="mr-1 size-7"
      symbolClassName="flex-1 text-[14px] font-medium relative top-[-1px]"
    />
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
    <div className="absolute right-4 top-4 flex cursor-pointer flex-wrap items-center justify-end gap-1">
      {PERCENTAGE_BUTTONS.map((button) => (
        <div
          key={button.value}
          className="flex cursor-pointer items-center gap-1 rounded-xl border border-border/80 bg-card/80 px-2.5 py-1 text-[13px] font-medium text-muted-foreground transition-colors hover:border-primary/35 hover:bg-primary/10 hover:text-foreground sm:text-sm"
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
    <FormPanel
      className="group relative flex min-w-0 flex-col gap-2 bg-secondary/55 transition-colors hover:border-primary/35"
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
        className={`grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 ${
          disabled ? "" : "mt-2 sm:mt-3"
        }`}
      >
        <NumericInput
          ref={amountInputRef}
          disabled={disabled}
          value={amount}
          onChange={onAmountChange ?? (() => {})}
          isLoading={isLoading}
          className="min-w-0 text-[30px] font-medium leading-none"
        />
        <CurrencySelector
          onCurrencyChange={(currency: Currency) =>
            onCurrencyChange(currency.address)
          }
          trigger={<CurrencySelectorTrigger currency={currency} />}
        />
      </div>
      <div className="flex min-w-0 items-center justify-between gap-2">
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
    </FormPanel>
  );
}
