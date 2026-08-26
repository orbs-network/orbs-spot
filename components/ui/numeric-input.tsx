import { NumericFormat } from "react-number-format";
import BN from "bignumber.js";
import { maxUint256 } from "viem";
import type { Ref } from "react";

import { cn } from "@/lib/utils";

type NumericInputProps = {
  "aria-label": string;
  className?: string;
  allowNegative?: boolean;
  disabled?: boolean;
  decimalScale?: number;
  onBlur?: () => void;
  onFocus?: () => void;
  placeholder?: string;
  maxValue?: number;
  name: string;
  prefix?: string;
  suffix?: string;
  value?: string;
  minAmount?: number;
  ref?: Ref<HTMLInputElement>;
  onChange: (value: string) => void;
  isLoading?: boolean;
};

export function NumericInput({
  "aria-label": ariaLabel,
  className = "",
  allowNegative = false,
  disabled = false,
  decimalScale = 18,
  onBlur,
  onFocus,
  placeholder,
  maxValue,
  name,
  prefix,
  ref,
  suffix,
  value,
  minAmount,
  onChange,
  isLoading = false,
}: NumericInputProps) {
  const inputValue = value || minAmount || "";

  return (
    <NumericFormat
      getInputRef={ref}
      aria-label={ariaLabel}
      autoComplete="off"
      className={cn(
        "h-full w-full bg-transparent text-[18px] outline-none placeholder:text-current placeholder:opacity-50",
        isLoading && "animate-pulse text-muted-foreground/35",
        className,
      )}
      allowNegative={allowNegative}
      disabled={disabled}
      decimalScale={decimalScale}
      inputMode="decimal"
      onBlur={onBlur}
      name={name}
      onFocus={onFocus}
      placeholder={placeholder || "0"}
      max={maxValue}
      isAllowed={(values) => {
        const { floatValue = 0 } = values;
        return maxValue
          ? floatValue <= parseFloat(maxValue.toString())
          : BN(floatValue).isLessThanOrEqualTo(maxUint256.toString());
      }}
      prefix={prefix ? `${prefix} ` : ""}
      suffix={suffix ? `${suffix} ` : ""}
      value={disabled && value === "0" ? "" : inputValue}
      thousandSeparator={","}
      decimalSeparator="."
      type="text"
      valueIsNumericString
      min={minAmount}
      onValueChange={(values, sourceInfo) => {
        if (sourceInfo.source !== "event") return;
        onChange(values.value === "." ? "0." : values.value);
      }}
    />
  );
}
