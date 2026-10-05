"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ExternalLinkIcon } from "lucide-react";
import { FORM_TABS, PERPS_URL } from "@/lib/consts";
import { preserveFormTabInHref, useSelectedFormTab } from "@/lib/hooks/use-form-tab";
import { FormTab } from "@/lib/types";
import { OrderHistoryLink } from "./order-history-trigger";

function useTradingHref() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Keep network/token and other trading parameters when changing order types.
  return pathname === "/" ? `/?${searchParams.toString()}` : "/";
}

export function TradingNavigation() {
  const { selectedTab } = useSelectedFormTab();
  const pathname = usePathname();
  const isTrading = pathname === "/";
  const href = useTradingHref();
  const isAdvanced = selectedTab.value !== FormTab.SWAP;
  const [lastAdvanced, setLastAdvanced] = useState<FormTab>(FormTab.TWAP);

  // This navigation stays mounted across routes, including Order history.
  // Remember URL selections (also browser Back/Forward) without duplicating them.
  if (isTrading && isAdvanced && lastAdvanced !== selectedTab.value) {
    setLastAdvanced(selectedTab.value);
  }

  return (
    <nav aria-label="Trading" data-trading-navigation>
      <div data-trading-modes>
        <Link href={preserveFormTabInHref(href, FormTab.SWAP)} scroll={false}
          aria-current={isTrading && !isAdvanced ? "page" : undefined}>Swap</Link>
        <Link href={preserveFormTabInHref(href, isAdvanced ? selectedTab.value : lastAdvanced)} scroll={false}
          aria-current={isTrading && isAdvanced ? "page" : undefined}>Advanced</Link>
        <OrderHistoryLink />
        <a data-perps-link href={PERPS_URL} target="_blank" rel="noopener noreferrer">
          Perps <ExternalLinkIcon aria-hidden="true" className="size-3" />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      </div>
    </nav>
  );
}

export function AdvancedOrderNavigation() {
  const { selectedTab } = useSelectedFormTab();
  const href = useTradingHref();
  if (selectedTab.value === FormTab.SWAP) return null;

  return (
    <nav aria-label="Advanced order type" data-advanced-order-navigation>
      {FORM_TABS.filter((tab) => tab.value !== FormTab.SWAP).map((tab) => (
        <Link key={tab.value} href={preserveFormTabInHref(href, tab.value)} scroll={false}
          aria-current={selectedTab.value === tab.value ? "page" : undefined}>
          {tab.fullLabel}
        </Link>
      ))}
    </nav>
  );
}
