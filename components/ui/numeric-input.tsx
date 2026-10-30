import { NumericFormat } from "react-number-format";
import BN from "bignumber.js";
import { maxUint256 } from "viem";
import { useId, useState, type Ref } from "react";

import { formatAmount } from "@/lib/token-display";
import { cn } from "@/lib/utils";
import { Input } from "./input";

type NumericInputProps = {
  "aria-label": string;
  "aria-describedby"?: string;
  error?: string;
  className?: string;
  allowNegative?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  decimalScale?: number;
  displayDecimals?: number;
  onBlur?: () => void;
  onFocus?: () => void;
  placeholder?: string;
  maxValue?: number;
  name: string;
  prefix?: string;
  showPositiveSign?: boolean;
  suffix?: string;
  value?: string;
  minAmount?: number;
  ref?: Ref<HTMLInputElement>;
  onChange: (value: string) => void;
  isLoading?: boolean;
};

export function NumericInput({
  "aria-label": ariaLabel,
  "aria-describedby": describedBy,
  error,
  className = "",
  allowNegative = false,
  disabled = false,
  readOnly = false,
  decimalScale = 18,
  displayDecimals = 4,
  onBlur,
  onFocus,
  placeholder,
  maxValue,
  name,
  prefix,
  showPositiveSign = false,
  ref,
  suffix,
  value,
  minAmount,
  onChange,
  isLoading = false,
}: NumericInputProps) {
  const errorId = useId();
  const [focused, setFocused] = useState(false);
  const rawValue = value || minAmount || "";
  const showDisplayValue = !focused || disabled || readOnly;
  const inputValue = showDisplayValue
    ? formatAmount(rawValue, displayDecimals, decimalScale) : rawValue;

  return (
    <>
      <NumericFormat
        customInput={Input}
        variant="bare"
        getInputRef={ref}
        aria-label={ariaLabel}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy ?? (error ? errorId : undefined)}
        autoComplete="off"
        className={cn(
          "h-full w-full bg-transparent text-[18px] outline-none placeholder:text-current placeholder:opacity-50",
          isLoading && "animate-pulse text-muted-foreground/35",
          className,
        )}
        allowNegative={allowNegative}
        disabled={disabled}
        readOnly={readOnly}
        decimalScale={decimalScale}
        inputMode="decimal"
        onBlur={() => {
          setFocused(false);
          onBlur?.();
        }}
        name={name}
        onFocus={() => {
          setFocused(true);
          onFocus?.();
        }}
        onFocusCapture={(event) => {
          const input = event.currentTarget;
          if (!suffix) return;

          // Clamp before the first paint; NumericFormat's focus correction runs in a timeout.
          const clampCaret = () => {
            if (document.activeElement !== input || input.selectionStart !== input.selectionEnd) return;

            const numericEnd = Math.max(0, input.value.length - suffix.length - 1);
            if (input.selectionStart !== null && input.selectionStart > numericEnd) {
              input.setSelectionRange(numericEnd, numericEnd);
            }
          };
          clampCaret();
          // Pointer focus can reset selection after the focus event, so check again before paint.
          requestAnimationFrame(clampCaret);
        }}
        placeholder={placeholder || "0"}
        max={maxValue}
        isAllowed={(values) => {
          // Keep an unfinished negative value editable while the user types.
          if (allowNegative && values.value === "-") return true;
          const numericValue = BN(values.value || "0");
          return numericValue.isFinite() && numericValue.lte(maxValue ?? maxUint256.toString());
        }}
        prefix={`${showPositiveSign && !String(rawValue).startsWith("-") && BN(rawValue).gte(0) ? "+" : ""}${prefix ? `${prefix} ` : ""}`}
        suffix={suffix ? `${suffix} ` : ""}
        value={disabled && value === "0" ? "" : inputValue}
        thousandSeparator={","}
        decimalSeparator="."
        type="text"
        valueIsNumericString
        min={minAmount}
        onValueChange={(values, sourceInfo) => {
          // Restoring or compacting a value must never change its stored precision.
          if (sourceInfo.source !== "event" || sourceInfo.event?.type === "blur") return;
          onChange(values.value === "." ? "0." : values.value);
        }}
      />
      {error && !describedBy && <span id={errorId} className="sr-only">{error}</span>}
    </>
  );
}
