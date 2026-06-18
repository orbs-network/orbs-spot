import { useState } from "react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { InfoIcon, PencilIcon, XIcon } from "lucide-react";
import { useSettings } from "@/lib/hooks/use-settings";
import { NumericInput } from "./ui/numeric-input";
import { DEFAULT_PRICE_PROTECTION, DEFAULT_SLIPPAGE } from "@/lib/consts";
import { cn } from "@/lib/utils";
import { useIsSpotTab } from "@/lib/hooks/use-form-tab";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import type { PercentSettingMode } from "@/lib/hooks/store";

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
    <DialogHeader className="flex-row items-center justify-between gap-4 border-b border-border/70 px-5 py-5 text-left sm:px-7">
      <div className="flex min-w-0 items-center gap-2">
        <DialogTitle className="text-[26px] font-semibold leading-none tracking-normal">
          {title}
        </DialogTitle>
        {tooltip && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="text-muted-foreground transition-colors hover:text-foreground"
                aria-label={`${title} info`}
              >
                <InfoIcon className="size-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>{tooltip}</TooltipContent>
          </Tooltip>
        )}
      </div>
      <DialogClose asChild>
        <button
          type="button"
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          aria-label="Close settings"
        >
          <XIcon className="size-5" />
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
  const activeIndex = isAuto
    ? 0
    : selectedPresetIndex >= 0
      ? selectedPresetIndex + 1
      : -1;

  return (
    <div className="px-5 py-6 sm:px-7">
      <div className="flex min-h-[76px] w-full flex-col gap-3 rounded-[24px] border border-border/70 bg-secondary/45 p-2 sm:flex-row sm:items-center">
        <div className="relative grid flex-1 grid-cols-4 overflow-hidden rounded-[20px] border border-border/60 bg-background/45 p-1">
          <div
            aria-hidden="true"
            className={cn(
              "absolute inset-y-1 left-1 z-0 rounded-[16px] bg-primary shadow-[var(--button-primary-shadow)] transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
              activeIndex < 0 && "opacity-0",
            )}
            style={{
              width: "calc((100% - 0.5rem) / 4)",
              transform: `translateX(${Math.max(activeIndex, 0) * 100}%)`,
            }}
          />
          <button
            type="button"
            onClick={() => onChange(defaultValue, "auto")}
            className={cn(
              "relative z-10 h-12 rounded-[16px] px-3 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground",
              isAuto && "text-primary-foreground hover:text-primary-foreground",
            )}
          >
            Auto
          </button>
          {presets.map((preset) => {
            const selected = !isAuto && value === preset;
            return (
              <button
                key={preset}
                type="button"
                onClick={() => onChange(preset, "custom")}
                className={cn(
                  "relative z-10 h-12 rounded-[16px] px-3 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground",
                  selected &&
                    "text-primary-foreground hover:text-primary-foreground",
                )}
              >
                {formatPreset(preset)}%
              </button>
            );
          })}
        </div>
        <div className="flex h-12 w-full items-center rounded-[18px] border border-border/80 px-3 transition-colors focus-within:border-primary sm:w-[150px]">
          <NumericInput
            value={value ? value.toString() : ""}
            onChange={(nextValue) => onChange(Number(nextValue), "custom")}
            className="text-center text-[18px] font-semibold"
            placeholder={formatPlaceholder(defaultValue)}
            decimalScale={2}
          />
          <span className="mx-2 h-6 w-px bg-border" />
          <span className="text-[18px] font-semibold text-muted-foreground">
            %
          </span>
        </div>
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

const SettingsInlineTrigger = () => {
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

  return (
    <div className="flex min-h-[58px] w-full items-center justify-between gap-3 rounded-[22px] border border-border/70 bg-secondary/35 px-4 text-left transition-colors hover:border-primary/45 hover:bg-secondary/55">
      <div className="flex min-w-0 items-center gap-2">
        <span className="text-[15px] font-semibold leading-none text-muted-foreground">
          {label}
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="text-muted-foreground transition-colors hover:text-foreground"
              aria-label={`${label} info`}
            >
              <InfoIcon className="size-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent>{tooltip}</TooltipContent>
        </Tooltip>
      </div>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label={`Open ${label} settings`}
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-[18px] bg-primary/14 px-4 text-[15px] font-semibold leading-none text-primary transition-colors hover:bg-primary/20 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:outline-none"
        >
          {displayValue}
          <PencilIcon className="size-4" />
        </button>
      </DialogTrigger>
    </div>
  );
};

export const SettingsModal = ({ className }: { className?: string }) => {
  const isSpotTab = useIsSpotTab();
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div className={className}>
        <SettingsInlineTrigger />
      </div>
      <DialogContent
        presentation="center"
        showCloseButton={false}
        className="w-[calc(100vw-1.5rem)] max-w-[640px] gap-0 overflow-hidden rounded-[28px] border-border/80 bg-card/98 p-0"
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
