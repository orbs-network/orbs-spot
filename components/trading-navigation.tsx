"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowDownUpIcon, ChartCandlestickIcon, Clock3Icon, CrosshairIcon, ExternalLinkIcon, HistoryIcon, TrendingDownIcon, TrendingUpIcon } from "lucide-react";
import { FORM_TABS, PERPS_URL } from "@/lib/consts";
import { preserveFormTabInHref, useSelectedFormTab } from "@/lib/hooks/use-form-tab";
import { FormTab } from "@/lib/types";

const icons = {
  [FormTab.SWAP]: ArrowDownUpIcon,
  [FormTab.TWAP]: Clock3Icon,
  [FormTab.LIMIT]: CrosshairIcon,
  [FormTab.STOP_LOSS]: TrendingDownIcon,
  [FormTab.TAKE_PROFIT]: TrendingUpIcon,
};

export function TradingNavigation({ onNavigate }: { onNavigate?: () => void }) {
  const { selectedTab } = useSelectedFormTab();
  const isHistory = usePathname() === "/orders";

  return (
    <nav aria-label="Order types" className="flex flex-col">
      {FORM_TABS.map((tab) => {
        const Icon = icons[tab.value];
        return (
          <Link key={tab.value} href={preserveFormTabInHref("/", tab.value)} onClick={onNavigate}
            aria-current={!isHistory && selectedTab.value === tab.value ? "page" : undefined} data-sidebar-item>
            <Icon aria-hidden="true" className="size-4" strokeWidth={1.5} />
            {tab.fullLabel}
          </Link>
        );
      })}
      <a href={PERPS_URL} target="_blank" rel="noopener noreferrer" onClick={onNavigate} data-sidebar-item>
        <ChartCandlestickIcon aria-hidden="true" className="size-4" strokeWidth={1.5} />
        <span className="inline-flex items-center gap-1.5">
          Perps
          <ExternalLinkIcon aria-hidden="true" className="size-3.5 shrink-0" strokeWidth={1.5} />
          <span className="sr-only">(opens in a new tab)</span>
        </span>
      </a>
      <div className="mt-5 border-t border-border pt-5">
        <Link href="/orders" onClick={onNavigate} data-sidebar-item aria-current={isHistory ? "page" : undefined}>
          <HistoryIcon aria-hidden="true" className="size-4" strokeWidth={1.5} />Order history
        </Link>
      </div>
    </nav>
  );
}
