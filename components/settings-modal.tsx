import { useState } from "react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { PencilIcon, XIcon } from "lucide-react";
import { useSettings } from "@/lib/hooks/use-settings";
import { NumericInput } from "./ui/numeric-input";
import { DEFAULT_PRICE_PROTECTION, DEFAULT_SLIPPAGE } from "@/lib/consts";
import { cn } from "@/lib/utils";
import { useIsSpotTab } from "@/lib/hooks/use-form-tab";
import type { PercentSettingMode } from "@/lib/hooks/store";
import { SegmentedTabs } from "./ui/tabs";
import { FormLabel, InfoTooltip } from "./ui/form-label";
import { FormNumberField } from "./ui/form-number-field";

const SLIPPAGE_PRESETS = [0.1, 0.5, 1] as const;
const PRICE_PROTECTION_PRESETS = [1, 3, 5] as const;
const SLIPPAGE_TOOLTIP =
  "Your transaction will revert if the price changes unfavorably by more than this percentage.";
const PRICE_PROTECTION_TOOLTIP =
  "The protocol uses an oracle price to help protect users from unfavorable executions. If the execution price is worse than the oracle price by more than the allowed percentage, the transaction will not be executed.";

const SettingsHeader = ({
  title,
  tooltip,
}: {
  title: string;
  tooltip?: string;
}) => {
  return (
    <DialogHeader className="flex-row items-center justify-between gap-4 border-b border-border/70 px-5 py-4 text-left sm:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <DialogTitle className="text-[16px] font-semibold leading-none tracking-normal sm:text-[18px]">
          {title}
        </DialogTitle>
        <InfoTooltip tooltip={tooltip} ariaLabel={`${title} info`} />
      </div>
      <DialogClose asChild>
        <button
          type="button"
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
          aria-label="Close settings"
        >
          <XIcon aria-hidden="true" className="size-5" />
        </button>
      </DialogClose>
    </DialogHeader>
  );
};

const formatPreset = (value: number) => value.toFixed(1);
const formatPlaceholder = (value: number) =>
  Number.isInteger(value) ? value.toString() : value.toFixed(2);
const formatInlinePercent = (value: number) => {
  if (!Number.isFinite(value)) return "0.00";
  if (value < 1) return value.toFixed(2);
  if (Number.isInteger(value)) return value.toString();
  return value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
};
type PercentTabValue = "auto" | number;

const PercentSettings = ({
  defaultValue,
  mode,
  onChange,
  presets,
  value,
}: {
  defaultValue: number;
  mode: PercentSettingMode;
  onChange: (value: number, mode?: PercentSettingMode) => void;
  presets: readonly number[];
  value: number;
}) => {
  const isAuto = mode === "auto";
  const selectedPresetIndex = presets.findIndex((preset) => value === preset);
  const selectedTabValue: PercentTabValue | undefined = isAuto
    ? "auto"
    : selectedPresetIndex >= 0
      ? presets[selectedPresetIndex]
      : undefined;
  const tabOptions: Array<{ value: PercentTabValue; label: string }> = [
    { value: "auto", label: "Auto" },
    ...presets.map((preset) => ({
      value: preset,
      label: `${formatPreset(preset)}%`,
    })),
  ];

  return (
    <div className="px-4 py-4 sm:px-6 sm:py-5">
      <div className="flex h-11 w-full items-center gap-2 sm:h-[42px] sm:gap-3">
        <SegmentedTabs
          aria-label="Preset percentage"
          value={selectedTabValue}
          options={tabOptions}
          onValueChange={(nextValue) => {
            if (nextValue === "auto") {
              onChange(defaultValue, "auto");
              return;
            }

            onChange(nextValue, "custom");
          }}
          className="h-full min-w-0 flex-1 rounded-[12px] border border-border/45 bg-secondary/25 p-1"
          indicatorClassName="rounded-[10px] bg-primary"
          tabClassName="rounded-[10px] px-2 text-sm font-semibold transition-colors"
          selectedTabClassName="text-primary-foreground hover:text-primary-foreground"
          unselectedTabClassName="text-muted-foreground hover:bg-accent/45 hover:text-foreground"
        />
        <FormNumberField className="h-full w-[92px] shrink-0 rounded-[12px] px-2 sm:w-[114px] sm:px-3">
          <NumericInput
            aria-label="Custom percentage"
            name="custom-percentage"
            value={value ? value.toString() : ""}
            onChange={(nextValue) => onChange(Number(nextValue), "custom")}
            className="text-center text-[16px] font-semibold"
            placeholder={formatPlaceholder(defaultValue)}
            decimalScale={2}
          />
          <span className="mx-2 h-5 w-px bg-border" />
          <span className="text-sm font-semibold text-muted-foreground">
            %
          </span>
        </FormNumberField>
      </div>
    </div>
  );
};

const SwapSettings = () => {
  const { slippage, slippageMode, setSlippage } = useSettings();

  return (
    <PercentSettings
      defaultValue={DEFAULT_SLIPPAGE}
      mode={slippageMode}
      onChange={setSlippage}
      presets={SLIPPAGE_PRESETS}
      value={slippage}
    />
  );
};

const SpotSettings = () => {
  const { priceProtection, priceProtectionMode, setPriceProtection } =
    useSettings();

  return (
    <PercentSettings
      defaultValue={DEFAULT_PRICE_PROTECTION}
      mode={priceProtectionMode}
      onChange={setPriceProtection}
      presets={PRICE_PROTECTION_PRESETS}
      value={priceProtection}
    />
  );
};

type SettingsTriggerVariant = "card" | "action";

const SettingsInlineTrigger = ({
  variant = "card",
}: {
  variant?: SettingsTriggerVariant;
}) => {
  const isSpotTab = useIsSpotTab();
  const { slippage, slippageMode, priceProtection, priceProtectionMode } =
    useSettings();
  const label = isSpotTab ? "Price Protection" : "Slippage Tolerance";
  const tooltip = isSpotTab ? PRICE_PROTECTION_TOOLTIP : SLIPPAGE_TOOLTIP;
  const value = isSpotTab ? priceProtection : slippage;
  const mode = isSpotTab ? priceProtectionMode : slippageMode;
  const formattedValue = formatInlinePercent(value);
  const displayValue =
    mode === "auto" ? `Auto: ${formattedValue}%` : `${formattedValue}%`;
  const isActionVariant = variant === "action";

  return (
    <div
      className={cn(
        "flex w-full items-center justify-between gap-3 text-left",
        isActionVariant
          ? "min-h-0"
          : "min-h-[46px] rounded-[18px] border border-border/70 bg-secondary/35 px-4 transition-colors hover:border-primary/25 hover:bg-secondary/40 max-sm:gap-2 max-sm:px-3",
      )}
    >
      <FormLabel
        className="min-w-0 flex-1 whitespace-nowrap max-sm:gap-1.5"
        textClassName="whitespace-nowrap max-sm:text-[13px]"
        tooltip={tooltip}
        tooltipAriaLabel={`${label} info`}
      >
        {label}
      </FormLabel>
      <DialogTrigger asChild>
        <button
          type="button"
          data-settings-trigger
          aria-label={`Open ${label} settings`}
          className={cn(
            "inline-flex shrink-0 items-center gap-2 rounded-[14px] font-semibold leading-none text-[var(--settings-trigger-foreground)] [background:var(--settings-trigger-background)] transition-colors hover:[background:var(--settings-trigger-hover-background)] focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:outline-none max-sm:gap-1.5",
            isActionVariant
              ? "h-10 px-3.5"
              : "h-10 px-4 max-sm:ml-auto max-sm:px-3",
            "text-sm",
          )}
        >
          {displayValue}
          <PencilIcon aria-hidden="true" className="size-4 max-sm:size-3.5" />
        </button>
      </DialogTrigger>
    </div>
  );
};

export const SettingsModal = ({
  className,
  triggerVariant = "card",
}: {
  className?: string;
  triggerVariant?: SettingsTriggerVariant;
}) => {
  const isSpotTab = useIsSpotTab();
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div className={className}>
        <SettingsInlineTrigger variant={triggerVariant} />
      </div>
      <DialogContent
        presentation="center"
        showCloseButton={false}
        className="w-[calc(100vw-1.5rem)] max-w-[512px] gap-0 overflow-hidden rounded-[22px] border-border/80 bg-card p-0"
      >
        <SettingsHeader
          title={isSpotTab ? "Price Protection" : "Slippage Setting"}
          tooltip={isSpotTab ? PRICE_PROTECTION_TOOLTIP : SLIPPAGE_TOOLTIP}
        />
        {isSpotTab ? <SpotSettings /> : <SwapSettings />}
      </DialogContent>
    </Dialog>
  );
};
