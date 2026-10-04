"use client";

import { useRef, useState } from "react";
import { CheckIcon, ChevronDownIcon, SearchIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { NetworkLabel, getNetworkLabel } from "./network-label";

export function NetworkSelector({ chains, value, onValueChange, includeAllNetworks = false, "aria-label": ariaLabel, placeholder = "Network", className, disabled }: {
  chains: readonly { id: number; name: string }[];
  value?: string;
  onValueChange: (value: string) => void;
  includeAllNetworks?: boolean;
  "aria-label": string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}) {
  const networkOptions = [
    ...(includeAllNetworks ? [{ value: "all", label: "All networks", search: "all networks" }] : []),
    ...chains.map(chain => ({
      value: String(chain.id),
      label: <NetworkLabel chainId={chain.id} />,
      search: `${chain.name} ${getNetworkLabel(chain.id)} ${chain.id}`.toLowerCase(),
    })),
  ];
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState("");
  const options = networkOptions.filter(option => option.search.includes(search.trim().toLowerCase()));
  const selected = networkOptions.find(option => option.value === value);

  return (
    <Popover responsive={false} open={open} onOpenChange={nextOpen => { setOpen(nextOpen); setSearch(""); }}>
      <PopoverTrigger asChild>
        <button
          ref={triggerRef}
          type="button"
          data-slot="select-trigger"
          data-chain-selector-trigger
          disabled={disabled}
          aria-label={ariaLabel}
          className={cn("flex min-h-11 w-full items-center justify-between gap-2 rounded-[14px] border border-border/80 bg-transparent px-3 text-sm font-medium text-foreground transition-colors hover:border-primary/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 disabled:cursor-wait disabled:opacity-60", className)}
        >
          <span className="flex min-w-0 items-center truncate">{selected?.label ?? placeholder}</span>
          <ChevronDownIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        ref={contentRef}
        tabIndex={-1}
        align="end"
        collisionPadding={16}
        aria-label={ariaLabel}
        onOpenAutoFocus={event => { event.preventDefault(); contentRef.current?.focus({ preventScroll: true }); }}
        onCloseAutoFocus={event => { event.preventDefault(); triggerRef.current?.focus(); }}
        className="flex max-h-[min(480px,var(--radix-popover-content-available-height))] w-64 max-w-[calc(100vw-2rem)] flex-col overflow-hidden p-0"
        onKeyDown={event => {
          const inSearch = event.target instanceof HTMLInputElement;
          if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key) || (inSearch && event.key !== "ArrowDown")) return;
          const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("[data-network-option]"));
          if (!buttons.length) return;
          event.preventDefault();
          const index = buttons.indexOf(event.target as HTMLButtonElement);
          const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length;
          buttons[nextIndex].focus();
        }}
      >
        <div className="relative shrink-0 border-b border-border p-2">
          <SearchIcon aria-hidden="true" className="pointer-events-none absolute left-5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input aria-label="Search networks" placeholder="Search networks…" value={search} onChange={event => setSearch(event.target.value)} className="pl-9" />
        </div>
        <div role="group" aria-label="Networks" className="min-h-0 overflow-y-auto overscroll-contain p-1">
          {options.map(option => (
            <button
              key={option.value}
              type="button"
              data-network-option
              data-chain-option
              aria-pressed={option.value === value}
              onClick={() => { onValueChange(option.value); setOpen(false); setSearch(""); }}
              className="flex min-h-9 w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium hover:bg-secondary focus-visible:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/50 aria-pressed:bg-primary/10"
            >
              {option.label}
              {option.value === value && <CheckIcon aria-hidden="true" className="size-4 shrink-0 text-primary" />}
            </button>
          ))}
          {!options.length && <p role="status" className="px-3 py-6 text-center text-sm text-muted-foreground">No networks found</p>}
        </div>
      </PopoverContent>
    </Popover>
  );
}
