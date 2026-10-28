"use client";

import { useId, useRef, useState } from "react";
import { CheckIcon, HandshakeIcon, SearchIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { compactSelectorTriggerClass, SelectorTrigger } from "@/components/ui/selector-trigger";
import styles from "@/components/network-selector.module.css";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/lib/hooks/use-is-mobile";
import { useSpotPartner } from "@/lib/hooks/use-spot-partner";
import { useSpotPartners } from "@/lib/hooks/use-spot-partners";

const partnerLabel = (name: string) => name.charAt(0).toUpperCase() + name.slice(1);

function PartnerSelectorContent() {
  const { partner, setPartner } = useSpotPartner();
  const { data, isPending, isError, isFetching, refetch } = useSpotPartners();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile("(max-width: 767px)");
  const partners = [...new Set(data?.map(item => item.name))];
  const options = partners.filter(name => name.toLowerCase().includes(search.trim().toLowerCase()));

  return <div data-partner-selector className="flex min-w-0 flex-col gap-2">
    <div className="flex min-w-0 items-center">
      <Popover open={open} onOpenChange={value => { setOpen(value); setSearch(""); }}>
        <PopoverTrigger asChild>
          <SelectorTrigger ref={triggerRef} data-partner-selector-trigger role="combobox" aria-label={`Select partner, current partner is ${partnerLabel(partner)}`}
            aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? menuId : undefined}
            disabled={isPending || !partners.length} className={compactSelectorTriggerClass}
            onKeyDown={event => {
              if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setOpen(true); }
            }}>
            <span className="inline-flex min-w-0 items-center gap-2 whitespace-nowrap">
              <HandshakeIcon aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 truncate leading-5">{isPending ? "Loading partners…" : partnerLabel(partner)}</span>
            </span>
          </SelectorTrigger>
        </PopoverTrigger>
        <PopoverContent ref={contentRef} id={menuId} tabIndex={-1} align="end" collisionPadding={16}
          drawerTitle="Select partner" aria-label="Select partner"
          className={styles.menu}
          onOpenAutoFocus={event => {
            event.preventDefault();
            (isMobile ? contentRef.current : searchRef.current)?.focus({ preventScroll: true });
          }}
          onCloseAutoFocus={event => { event.preventDefault(); triggerRef.current?.focus({ preventScroll: true }); }}
          onKeyDown={event => {
            const inSearch = event.target instanceof HTMLInputElement;
            if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key) || (inSearch && event.key !== "ArrowDown")) return;
            const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("[data-partner-option]"));
            if (!buttons.length) return;
            event.preventDefault();
            const index = buttons.indexOf(event.target as HTMLButtonElement);
            const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 :
              (index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length;
            buttons[nextIndex].focus();
          }}>
          <div className="flex shrink-0 items-center justify-between px-4 pt-3 pb-1 md:hidden">
            <h2 className="text-base font-semibold">Select partner</h2>
            <button type="button" data-icon-button aria-label="Close partner selector" onClick={() => setOpen(false)}
              className="flex size-9 items-center justify-center text-muted-foreground focus-visible:outline-2 focus-visible:outline-primary">
              <XIcon aria-hidden="true" className="size-5" />
            </button>
          </div>
          <div className={styles.search}>
            <SearchIcon aria-hidden="true" className="pointer-events-none absolute left-6 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input ref={searchRef} type="search" name="partner-search" aria-label="Search partners"
              autoComplete="off" spellCheck={false} placeholder="Search partners…" className="pl-9"
              value={search} onChange={event => setSearch(event.target.value)} />
          </div>
          <div role="group" aria-label="Partners" data-vaul-no-drag className={styles.options}>
            {options.length > 0 && <p className={styles.sectionLabel}>Available partners</p>}
            {options.map(name => <button key={name} type="button" data-partner-option data-selector-option
              aria-pressed={partner === name} className={cn(styles.option, "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/50")}
              onClick={() => { setPartner(name); setOpen(false); setSearch(""); }}>
              <span className="min-w-0 truncate leading-5">{partnerLabel(name)}</span>
              {partner === name && <span aria-hidden="true" className={styles.selected}><CheckIcon className="size-3" strokeWidth={3} /></span>}
            </button>)}
            {!options.length && <p role="status" className="px-3 py-6 text-center text-sm text-muted-foreground">No partners match.</p>}
          </div>
        </PopoverContent>
      </Popover>
    </div>
    {isError ? <div role="alert" className="flex flex-wrap items-center gap-2 text-sm">
      <span>Unable to load partners.</span>
      <Button variant="outline" size="sm" disabled={isFetching} onClick={() => void refetch()}>
        {isFetching ? "Retrying…" : "Retry"}
      </Button>
    </div> : data?.length === 0 ? <p role="status" className="text-sm text-muted-foreground">No partners available.</p> : null}
  </div>;
}

export function PartnerSelector() {
  const { isDebugMode } = useSpotPartner();
  return isDebugMode ? <PartnerSelectorContent /> : null;
}
