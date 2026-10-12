"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import { CheckIcon, ChevronDownIcon, XIcon } from "lucide-react";
import { useIsMobile } from "@/lib/hooks/use-is-mobile";
import { Button } from "./button";
import { Drawer, DrawerClose, DrawerContent, DrawerTitle, DrawerTrigger } from "./drawer";

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

const triggerClassName = "h-full min-h-11 w-full self-stretch rounded-[14px] border border-border/80 bg-transparent px-3 text-sm font-medium text-foreground transition-colors focus-visible:border-primary focus-visible:outline-none";

function MobileSelect<TValue extends string | number>({ label, options, value, placeholder, onValueChange, error, errorId }: {
  label: string; options: readonly StyledSelectOption<TValue>[]; value: TValue;
  placeholder?: string; onValueChange: (value: TValue) => void; error?: string; errorId: string;
}) {
  const [open, setOpen] = useState(false);
  const contentId = useId();
  const selected = options.find(option => option.value === value);
  const contentRef = useRef<HTMLDivElement>(null);

  return <Drawer open={open} onOpenChange={setOpen}>
    <DrawerTrigger asChild>
      <button type="button" role="combobox" data-slot="select-trigger" aria-label={label} aria-controls={contentId} aria-expanded={open} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} className={`${triggerClassName} flex items-center justify-between gap-2`} onKeyDown={event => {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setOpen(true); }
      }}>
        <span data-slot="select-value">{selected?.label ?? placeholder}</span><ChevronDownIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
      </button>
    </DrawerTrigger>
    <DrawerContent id={contentId} ref={contentRef} data-mobile-select aria-describedby={undefined} className="gap-2 px-4 pb-[max(16px,env(safe-area-inset-bottom))]" onOpenAutoFocus={event => {
      event.preventDefault();
      contentRef.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus({ preventScroll: true });
    }}>
      <div className="flex items-center justify-between">
        <DrawerTitle className="text-base font-medium">{label}</DrawerTitle>
        <DrawerClose asChild><Button variant="ghost" size="icon" className="size-11" aria-label={`Close ${label}`}><XIcon aria-hidden="true" className="size-4" /></Button></DrawerClose>
      </div>
      <div role="group" aria-label={label} data-vaul-no-drag className="min-h-0 overflow-y-auto">
        {options.map(option => <Button key={String(option.value)} variant="ghost" data-hover="option" aria-pressed={option.value === value} className="h-11 w-full justify-between rounded-lg px-3 font-normal" onClick={() => { onValueChange(option.value); setOpen(false); }}>
          {option.label}{option.value === value && <CheckIcon aria-hidden="true" className="size-4 text-primary" />}
        </Button>)}
      </div>
    </DrawerContent>
  </Drawer>;
}

export function StyledSelect<TValue extends string | number>({
  "aria-label": ariaLabel,
  error,
  onValueChange,
  options,
  placeholder,
  value,
}: {
  "aria-label": string;
  error?: string;
  onValueChange: (value: TValue) => void;
  options: readonly StyledSelectOption<TValue>[];
  placeholder?: string;
  value: TValue;
}) {
  const errorId = useId();
  const isMobile = useIsMobile("(max-width: 767px)");
  return (
    <>
      {isMobile ? <MobileSelect label={ariaLabel} options={options} value={value} placeholder={placeholder} onValueChange={onValueChange} error={error} errorId={errorId} /> :
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
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className={triggerClassName}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent data-styled-select align="end" sideOffset={4} className="min-w-[max(140px,var(--radix-select-trigger-width))] rounded-xl border-border/80 bg-popover p-1 shadow-lg [&_[data-slot=select-viewport]]:p-0">
          {options.map((item) => (
            <SelectItem
              key={String(item.value)}
              value={String(item.value)}
              indicator={<CheckIcon aria-hidden="true" className="size-3.5 text-primary" />}
              className="min-h-9 rounded-lg px-3 pr-9 text-xs font-normal text-foreground focus:bg-primary/6 focus:text-foreground data-[state=checked]:text-primary max-sm:min-h-11"
            >
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>}
      {error && <span id={errorId} className="sr-only">{error}</span>}
    </>
  );
}
