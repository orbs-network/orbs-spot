import type * as React from "react";

import { cn } from "@/lib/utils";

export type SegmentedTabOption<TValue extends string | number> = {
  value: TValue;
  label: React.ReactNode;
  title?: string;
  ariaLabel?: string;
};

export type SegmentedTabsProps<TValue extends string | number> = {
  "aria-label": string;
  value?: TValue;
  options: readonly SegmentedTabOption<TValue>[];
  onValueChange: (value: TValue) => void;
  className?: string;
  indicatorClassName?: string;
  tabClassName?: string;
  selectedTabClassName?: string;
  unselectedTabClassName?: string;
};

const DEFAULT_SEGMENTED_TABS_CLASS_NAME =
  "hidden min-w-0 flex-1 rounded-[22px] border border-border/70 bg-secondary/50 p-1 sm:grid";
const DEFAULT_SEGMENTED_TABS_INDICATOR_CLASS_NAME =
  "rounded-[18px] [background:var(--selected-tab-background)]";
const DEFAULT_SEGMENTED_TABS_TAB_CLASS_NAME =
  "h-8 rounded-[18px] px-1 text-[12px] leading-none transition-colors duration-200";
const DEFAULT_SEGMENTED_TABS_SELECTED_CLASS_NAME =
  "font-bold text-primary-foreground hover:text-primary-foreground";
const DEFAULT_SEGMENTED_TABS_UNSELECTED_CLASS_NAME =
  "font-semibold text-muted-foreground hover:bg-accent/45 hover:text-foreground";

export function SegmentedTabs<TValue extends string | number>({
  "aria-label": ariaLabel,
  value,
  options,
  onValueChange,
  className,
  indicatorClassName,
  tabClassName,
  selectedTabClassName,
  unselectedTabClassName,
}: SegmentedTabsProps<TValue>) {
  const tabCount = Math.max(options.length, 1);
  const activeIndex =
    value === undefined
      ? -1
      : options.findIndex((option) => option.value === value);

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "relative grid overflow-hidden",
        className ?? DEFAULT_SEGMENTED_TABS_CLASS_NAME,
      )}
      style={{
        gridTemplateColumns: `repeat(${tabCount}, minmax(0, 1fr))`,
      }}
    >
      <div
        aria-hidden="true"
        className={cn(
          "absolute inset-y-1 left-1 z-0 transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
          activeIndex < 0 && "opacity-0",
          indicatorClassName ?? DEFAULT_SEGMENTED_TABS_INDICATOR_CLASS_NAME,
        )}
        style={{
          width: `calc((100% - 0.5rem) / ${tabCount})`,
          transform: `translateX(${Math.max(activeIndex, 0) * 100}%)`,
        }}
      />
      {options.map((option) => {
        const selected = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-label={option.ariaLabel}
            title={option.title}
            onClick={() => onValueChange(option.value)}
            className={cn(
              "relative z-10",
              tabClassName ?? DEFAULT_SEGMENTED_TABS_TAB_CLASS_NAME,
              selected
                ? selectedTabClassName ??
                    DEFAULT_SEGMENTED_TABS_SELECTED_CLASS_NAME
                : unselectedTabClassName ??
                    DEFAULT_SEGMENTED_TABS_UNSELECTED_CLASS_NAME,
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
