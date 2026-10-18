"use client";

import { useEffect, useRef } from "react";
import { AppLink } from "@/components/app-link";
import { usePathname, useSearchParams } from "next/navigation";
import { ExternalLinkIcon } from "lucide-react";
import { FORM_TABS, PERPS_URL } from "@/lib/consts";
import { preserveFormTabInHref, useSelectedFormTab } from "@/lib/hooks/use-form-tab";
import { OrderHistoryLink } from "./order-history-trigger";
import { getTradingPathname } from "@/lib/developer-routes";
import Image from "next/image";

function useTradingHref() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Keep network/token and other trading parameters when changing order types.
  return getTradingPathname(pathname) === "/" ? `/?${searchParams.toString()}` : "/";
}

export function TradingNavigation() {
  const { selectedTab } = useSelectedFormTab();
  const pathname = usePathname();
  const isTrading = getTradingPathname(pathname) === "/";
  const href = useTradingHref();

  return (
    <nav aria-label="Trading" data-trading-navigation>
      <div data-trading-modes>
        <AppLink href={preserveFormTabInHref(href, selectedTab.value)} scroll={false}
          aria-current={isTrading ? "page" : undefined}>
          <Image data-product-mark="spot" src="/dspot-logo.svg" alt="" aria-hidden="true" width={25} height={25} />
          dSPOT
        </AppLink>
        <a data-perps-link href={PERPS_URL} target="_blank" rel="noopener noreferrer">
          <Image data-product-mark="perps" src="/dperps-logo.svg" alt="" aria-hidden="true" width={25} height={25} />
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
        <AppLink key={tab.value} href={preserveFormTabInHref(href, tab.value)} scroll={false}
          aria-current={selectedTab.value === tab.value ? "page" : undefined}>
          {tab.fullLabel}
        </AppLink>
      ))}
    </nav>
  );
}
