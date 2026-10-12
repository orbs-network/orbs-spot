"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ExternalLinkIcon } from "lucide-react";
import { FORM_TABS, PERPS_URL } from "@/lib/consts";
import { preserveFormTabInHref, useSelectedFormTab } from "@/lib/hooks/use-form-tab";
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

  return (
    <nav aria-label="Trading" data-trading-navigation>
      <div data-trading-modes>
        <Link href={preserveFormTabInHref(href, selectedTab.value)} scroll={false}
          aria-current={isTrading ? "page" : undefined}>
          <svg data-product-mark="spot" aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
            <path d="M2 3 11 8 2 13ZM22 1 13 6 22 11ZM2 15 11 10 11 22ZM13 13 22 18 13 23Z" />
          </svg>
          dSPOT
        </Link>
        <a data-perps-link href={PERPS_URL} target="_blank" rel="noopener noreferrer">
          <svg data-product-mark="perps" aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
            <path d="M7 2 12 10H2ZM14 2H24L19 10ZM5 14 10 22H0ZM12 14H22L17 22Z" />
          </svg>
          dPERPS <ExternalLinkIcon aria-hidden="true" className="size-3" />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
        <OrderHistoryLink />
      </div>
    </nav>
  );
}

export function SpotOrderNavigation() {
  const { selectedTab } = useSelectedFormTab();
  const href = useTradingHref();
  const navigationRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const navigation = navigationRef.current;
    const activeLink = navigation?.querySelector('[aria-current="page"]');
    if (!navigation || !activeLink) return;

    // Keep deep links and Back/Forward selections visible in the mobile row.
    const revealActiveLink = () => {
      const row = navigation.getBoundingClientRect();
      const active = activeLink.getBoundingClientRect();
      const padding = getComputedStyle(navigation);
      const left = row.left + (parseFloat(padding.paddingLeft) || 0);
      const right = row.right - (parseFloat(padding.paddingRight) || 0);
      if (active.right > right) navigation.scrollLeft += active.right - right;
      else if (active.left < left) navigation.scrollLeft -= left - active.left;
    };
    revealActiveLink();
    const resizeObserver = new ResizeObserver(revealActiveLink);
    resizeObserver.observe(navigation);
    return () => resizeObserver.disconnect();
  }, [selectedTab.value]);

  return (
    <nav ref={navigationRef} aria-label="dSPOT order type" data-spot-order-navigation>
      {FORM_TABS.map((tab) => (
        <Link key={tab.value} href={preserveFormTabInHref(href, tab.value)} scroll={false}
          aria-current={selectedTab.value === tab.value ? "page" : undefined}>
          {tab.fullLabel}
        </Link>
      ))}
    </nav>
  );
}
