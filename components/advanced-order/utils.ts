import { FormTab } from "@/lib/types";
import type { useTranslations } from "@/lib/use-translations";
import { Module, TimeUnit } from "@orbs-network/spot-react";
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
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(deadline));
}
