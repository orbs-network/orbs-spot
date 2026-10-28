"use client";
import { useState } from "react";
import { AppLink } from "@/components/app-link";
import { usePathname, useSearchParams } from "next/navigation";
import { ArrowUpRightIcon, ChevronDownIcon, Code2Icon, EllipsisIcon, GithubIcon, ScanLineIcon } from "lucide-react";
import { preserveDeveloperModeInHref, useDeveloperMode } from "@/lib/hooks/use-developer-mode";
import { preserveFormTabInHref, useSelectedFormTab } from "@/lib/hooks/use-form-tab";
import { SPOT_TABS } from "@/lib/consts";
import { cn } from "@/lib/utils";
import { NavPillButton, navPillClass } from "@/components/ui/nav-pill";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getSpotDocsHref } from "./docs";
import { getMainTradingHref, getTradingPathname, ORDER_INSPECTOR_PATH } from "@/lib/developer-routes";
import Link from "next/link";

export function DeveloperMoreNavigation() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const mainHref = getMainTradingHref(useSearchParams().toString());
  const { selectedTab } = useSelectedFormTab();
  const itemClass = "flex min-h-11 items-center gap-3 rounded-[11px] px-3 py-2 text-sm font-semibold transition-colors focus-visible:bg-secondary/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45";

  return (
    <div className="hidden md:block"><Popover open={open} onOpenChange={setOpen}>
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
        <Link href={mainHref} onClick={() => setOpen(false)} className={itemClass}>Back to trading</Link>
        <AppLink href={preserveFormTabInHref("/dev/orders?mockorders=true", selectedTab.value)} onClick={() => setOpen(false)} className={itemClass}>Sample orders</AppLink>
        <AppLink
          href={preserveFormTabInHref(ORDER_INSPECTOR_PATH, selectedTab.value)}
          aria-current={pathname === ORDER_INSPECTOR_PATH ? "page" : undefined}
          onClick={() => setOpen(false)}
          className={cn(itemClass, pathname === ORDER_INSPECTOR_PATH && "text-primary")}
        >
          <ScanLineIcon aria-hidden="true" className="size-4 shrink-0 text-primary" />
          Order preview
        </AppLink>
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
    </Popover></div>
  );
}

export function DeveloperNavigation() {
  const { isDeveloperMode, isDeveloperPlayground } = useDeveloperMode();
  const { selectedTab } = useSelectedFormTab();
  const pathname = getTradingPathname(usePathname());
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
        href: "https://github.com/orbs-network/spot-ui/blob/master/skills/spot-integration/references/07-swap-and-migration.md",
        linkLabel: "Spot Docs",
        tooltip: "Open Spot integration guide",
      };

  if (!isDeveloperPlayground || !isDeveloperMode || isDeveloperGuideRoute) return null;

  return (
    <Tooltip action>
      <TooltipTrigger asChild>
        <AppLink
          data-nav-pill
          data-developer-navigation
          data-developer-trigger
          data-developer-guide-link
          href={preserveDeveloperModeInHref(
            preserveFormTabInHref(developerGuide.href, selectedTab.value),
            isDeveloperMode,
          )}
          target="_blank"
          rel="noreferrer"
          aria-label={developerGuide.tooltip}
          className={cn(navPillClass, "w-10 justify-center p-0 sm:w-auto sm:px-3")}
        >
          <Code2Icon aria-hidden="true" className="size-4" />
          <span className="hidden sm:inline">{developerGuide.linkLabel}</span>
        </AppLink>
      </TooltipTrigger>
      <TooltipContent>{developerGuide.tooltip}</TooltipContent>
    </Tooltip>
  );
}
