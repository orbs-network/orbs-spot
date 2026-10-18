import { FormTab } from "@/lib/types";
import { formatDateTime } from "@/lib/date";
import type { useTranslations } from "@/lib/use-translations";
import { InputErrors, Module, TimeUnit, type InputError } from "@orbs-network/spot-ui";
import { MODULE_META } from "./constants";

export type Translate = ReturnType<typeof useTranslations>;

export function getModule(tab: FormTab) {
  switch (tab) {
    case FormTab.LIMIT:
      return Module.LIMIT;
    case FormTab.STOP_LOSS:
      return Module.STOP_LOSS;
    case FormTab.TAKE_PROFIT:
      return Module.TAKE_PROFIT;
    case FormTab.TWAP:
    default:
      return Module.TWAP;
  }
}

export function getOrderTitle(orderModule: Module, t: Translate) {
  return t(MODULE_META[orderModule]?.titleKey ?? "placeOrder");
}

export function formatInputError(
  error?: {
    type?: string;
    args?: Record<string, string>;
    value?: string | number;
  },
  t?: Translate,
) {
  if (!error?.type) return "";

  const translationKey =
    error.type === "missingLimitPrice" ? "emptyLimitPrice" : error.type;

  return t?.(translationKey, error.args) ?? translationKey;
}

function formatDurationUnit(value: number, unit: string) {
  return `${value} ${unit}${value === 1 ? "" : "s"}`;
}

export function formatPriceInputError(error: InputError | undefined, isInverted: boolean, t: Translate) {
  if (error?.type === InputErrors.TRIGGER_LIMIT_PRICE_GREATER_THAN_TRIGGER_PRICE) {
    return `This limit price may prevent execution after the trigger. Set it ${isInverted ? "above" : "below"} the trigger price. A fast price move may still leave the order unfilled.`;
  }
  if (error?.type === InputErrors.STOP_LOSS_TRIGGER_PRICE_GREATER_THAN_MARKET_PRICE) {
    return `Set the trigger rate ${isInverted ? "above" : "below"} the market rate for a stop-loss order.`;
  }
  if (error?.type === InputErrors.TAKE_PROFIT_TRIGGER_PRICE_LESS_THAN_MARKET_PRICE) {
    return `Set the trigger rate ${isInverted ? "below" : "above"} the market rate for a take-profit order.`;
  }
  return formatInputError(error, t);
}

export function formatDuration(ms?: number) {
  if (!ms) return "";
  const minutes = Math.round(ms / TimeUnit.Minutes);
  if (minutes < 60) return formatDurationUnit(minutes, "Minute");
  const hours = Math.round(ms / TimeUnit.Hours);
  if (hours < 48) return formatDurationUnit(hours, "Hour");
  const days = Math.round(ms / TimeUnit.Days);
  return formatDurationUnit(days, "Day");
}

export function formatDeadline(deadline?: number) {
  if (!deadline) return "";
  return formatDateTime(deadline);
}

export function formatTwapDuration(ms: number) {
  const minutes = Math.max(1, Math.round(ms / TimeUnit.Minutes));
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return hours ? `${hours}h${remainder ? ` ${remainder}m` : ""}` : `${minutes}m`;
}
