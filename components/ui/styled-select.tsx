import type { ReactNode } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";

export type StyledSelectOption<TValue extends string | number> = {
  label: ReactNode;
  value: TValue;
};

export function StyledSelect<TValue extends string | number>({
  "aria-label": ariaLabel,
  onValueChange,
  options,
  placeholder,
  value,
}: {
  "aria-label": string;
  onValueChange: (value: TValue) => void;
  options: readonly StyledSelectOption<TValue>[];
  placeholder?: string;
  value: TValue;
}) {
  return (
    <Select
      value={String(value)}
      onValueChange={(nextValue) => {
        const item = options.find(
          (option) => String(option.value) === nextValue,
        );

        if (item) {
          onValueChange(item.value);
        }
      }}
    >
      <SelectTrigger
        aria-label={ariaLabel}
        className="h-full min-h-11 w-full self-stretch rounded-[14px] border-border/80 bg-transparent px-3 text-sm font-medium text-foreground transition-colors hover:border-primary/35 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25"
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="gap-1 rounded-[14px] border-border/80 bg-popover p-1">
        {options.map((item) => (
          <SelectItem
            key={String(item.value)}
            value={String(item.value)}
            className="h-10 rounded-[11px] text-sm font-medium text-muted-foreground hover:bg-secondary/45 hover:text-foreground focus:bg-secondary/45 focus:text-foreground data-[state=checked]:bg-primary/14 data-[state=checked]:text-foreground"
          >
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
