"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRightIcon, ChevronDownIcon, Code2Icon, EllipsisIcon, GithubIcon, ScanLineIcon } from "lucide-react";
import { preserveDeveloperModeInHref, useDeveloperMode } from "@/lib/hooks/use-developer-mode";
import { preserveFormTabInHref, useSelectedFormTab } from "@/lib/hooks/use-form-tab";
import { SPOT_TABS } from "@/lib/consts";
import { cn } from "@/lib/utils";
import { NavPillButton, navPillClass } from "@/components/ui/nav-pill";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getSpotDocsHref } from "./docs";

export function DeveloperMoreNavigation({ isDeveloperMode }: { isDeveloperMode: boolean }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const itemClass = "flex min-h-11 items-center gap-3 rounded-[11px] px-3 py-2 text-sm font-semibold transition-colors hover:bg-secondary/55 focus-visible:bg-secondary/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45";

  return (
    <Popover open={open} onOpenChange={setOpen} responsive={false}>
      <PopoverTrigger asChild>
        <NavPillButton aria-label="More" className="w-10 justify-center p-0 sm:w-auto sm:px-3">
          <EllipsisIcon aria-hidden="true" className="size-4 sm:hidden" />
          <span className="hidden sm:inline">More</span>
          <ChevronDownIcon
            aria-hidden="true"
            className={cn("hidden size-4 text-muted-foreground transition-transform motion-reduce:transition-none sm:block", open && "rotate-180")}
          />
        </NavPillButton>
      </PopoverTrigger>
      <PopoverContent align="end" aria-label="More navigation" className="w-60 max-w-[calc(100vw-2rem)] p-2 motion-reduce:animate-none">
        <Link
          href={preserveDeveloperModeInHref("/developers/eip712", isDeveloperMode)}
          aria-current={pathname === "/developers/eip712" ? "page" : undefined}
          onClick={() => setOpen(false)}
          className={cn(itemClass, pathname === "/developers/eip712" && "text-primary")}
        >
          <ScanLineIcon aria-hidden="true" className="size-4 shrink-0 text-primary" />
          Order preview
        </Link>
        <a
          href="https://github.com/orbs-network/orbs-spot"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="View Orbs Spot on GitHub (opens in a new tab)"
          onClick={() => setOpen(false)}
          className={itemClass}
        >
          <GithubIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
          GitHub
          <ArrowUpRightIcon aria-hidden="true" className="ml-auto size-3.5 text-muted-foreground" />
        </a>
      </PopoverContent>
    </Popover>
  );
}

export function DeveloperNavigation() {
  const { isDeveloperMode, setIsDeveloperMode, isDeveloperToolsAvailable } = useDeveloperMode();
  const { selectedTab } = useSelectedFormTab();
  const pathname = usePathname();
  const isDeveloperGuideRoute =
    pathname === "/developers" || pathname.startsWith("/developers/");
  const isSpotTab = SPOT_TABS.includes(
    selectedTab.value as (typeof SPOT_TABS)[number],
  );
  const developerGuide = isSpotTab
    ? {
        href: getSpotDocsHref("/advanced-orders/typescript"),
        linkLabel: "Advanced Order Docs",
        tooltip: "Open Advanced Order Docs",
      }
    : {
        href: getSpotDocsHref("/liquidity-hub"),
        linkLabel: "Liquidity Hub Docs",
        tooltip: "Open Liquidity Hub integration guide",
      };

  return <>
          {isDeveloperMode && !isDeveloperGuideRoute && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  data-nav-pill
                  data-developer-trigger
                  data-developer-guide-link
                  href={preserveDeveloperModeInHref(
                    preserveFormTabInHref(
                      developerGuide.href,
                      selectedTab.value,
                    ),
                    isDeveloperMode,
                  )}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={developerGuide.tooltip}
                  className={cn(
                    navPillClass,
                    "w-10 justify-center p-0 sm:w-auto sm:px-3",
                  )}
                >
                  <Code2Icon aria-hidden="true" className="size-4" />
                  <span className="hidden sm:inline">
                    {developerGuide.linkLabel}
                  </span>
                </Link>
              </TooltipTrigger>
              <TooltipContent>{developerGuide.tooltip}</TooltipContent>
            </Tooltip>
          )}
          {isDeveloperToolsAvailable && !isDeveloperGuideRoute && (
            <div className="flex h-10 items-center gap-2 rounded-full border border-border/70 bg-[var(--nav-pill-background)] px-2 sm:px-3">
              <label
                htmlFor="navbar-developer-mode"
                className="hidden cursor-pointer whitespace-nowrap text-xs font-semibold text-foreground sm:block"
              >
                Dev mode
              </label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex">
                    <Switch
                      id="navbar-developer-mode"
                      checked={isDeveloperMode}
                      onCheckedChange={setIsDeveloperMode}
                      aria-label="Developer mode"
                    />
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  Show developer code and request controls
                </TooltipContent>
              </Tooltip>
            </div>
          )}

  </>;
}
