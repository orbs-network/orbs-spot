/* eslint-disable @next/next/no-img-element */
"use client";

import { Fragment, useRef, useState } from "react";
import { CheckIcon, ChevronDownIcon, SearchIcon, XIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { NetworkLabel, getNetworkLabel } from "./network-label";
import { CHAIN_LOGO_URLS } from "@/lib/consts";
import styles from "./network-selector.module.css";

function AllNetworksLabel({ chains }: { chains: readonly { id: number }[] }) {
  return <span className="inline-flex min-w-0 items-center gap-3 whitespace-nowrap">
    <span aria-hidden="true" className={styles.networkGrid}>
      {chains.slice(0, 4).map(chain => <img key={chain.id} src={CHAIN_LOGO_URLS[chain.id as keyof typeof CHAIN_LOGO_URLS]} alt="" width={10} height={10} />)}
    </span>
    <span className="truncate leading-5">All networks</span>
  </span>;
}

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
    ...(includeAllNetworks ? [{
      value: "all",
      label: <AllNetworksLabel chains={chains} />,
      menuLabel: <AllNetworksLabel chains={chains} />,
      search: "all networks",
    }] : []),
    ...chains.map(chain => ({
      value: String(chain.id),
      label: <NetworkLabel chainId={chain.id} />,
      menuLabel: <NetworkLabel chainId={chain.id} variant="full" />,
      search: `${chain.name} ${getNetworkLabel(chain.id)} ${chain.id}`.toLowerCase(),
    })),
  ];
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState("");
  const options = networkOptions.filter(option => option.search.includes(search.trim().toLowerCase()));
  const firstNetworkIndex = options.findIndex(option => option.value !== "all");
  const selected = networkOptions.find(option => option.value === value);

  return (
    <Popover open={open} onOpenChange={nextOpen => { setOpen(nextOpen); setSearch(""); }}>
      <PopoverTrigger asChild>
        <button
          ref={triggerRef}
          type="button"
          data-slot="select-trigger"
          data-chain-selector-trigger
          disabled={disabled}
          aria-label={ariaLabel}
          className={cn("flex min-h-11 w-full items-center justify-between gap-2 rounded-[14px] border border-border/80 bg-transparent px-3 text-sm font-medium text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 disabled:cursor-wait disabled:opacity-60", className)}
        >
          <span className="flex min-w-0 items-center truncate">{selected?.label ?? placeholder}</span>
          <ChevronDownIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        ref={contentRef}
        data-network-menu
        tabIndex={-1}
        align="end"
        collisionPadding={16}
        drawerTitle="Select network"
        aria-label={ariaLabel}
        aria-describedby={undefined}
        onOpenAutoFocus={event => { event.preventDefault(); contentRef.current?.focus({ preventScroll: true }); }}
        onCloseAutoFocus={event => { event.preventDefault(); triggerRef.current?.focus(); }}
        className={styles.menu}
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
        <div className="flex shrink-0 items-center justify-between px-4 pt-3 pb-1 md:hidden">
          <h2 className="text-base font-semibold">Select network</h2>
          <button
            type="button"
            data-icon-button
            aria-label="Close network selector"
            onClick={() => setOpen(false)}
            className="flex size-9 items-center justify-center text-muted-foreground focus-visible:outline-2 focus-visible:outline-primary"
          >
            <XIcon aria-hidden="true" className="size-5" />
          </button>
        </div>
        <div className={styles.search}>
          <SearchIcon aria-hidden="true" className="pointer-events-none absolute left-6 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input aria-label="Search networks" placeholder="Search networks…" value={search} onChange={event => setSearch(event.target.value)} className="pl-9" />
        </div>
        <div role="group" aria-label="Networks" data-network-options data-vaul-no-drag className={styles.options}>
          {options.map((option, index) => (
            <Fragment key={option.value}>
            {index === firstNetworkIndex && <p className={styles.sectionLabel}>Available networks</p>}
            <button
              type="button"
              data-network-option
              data-chain-option
              aria-pressed={option.value === value}
              onClick={() => { onValueChange(option.value); setOpen(false); setSearch(""); }}
              className={cn(styles.option, "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/50")}
            >
              {option.menuLabel}
              {option.value === value && <span data-network-selected aria-hidden="true" className={styles.selected}><CheckIcon className="size-3" strokeWidth={3} /></span>}
            </button>
            </Fragment>
          ))}
          {!options.length && <p role="status" className="px-3 py-6 text-center text-sm text-muted-foreground">No networks found</p>}
        </div>
      </PopoverContent>
    </Popover>
  );
}
