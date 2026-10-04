"use client";

import { useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { pushUrlState } from "@/lib/url-state";

/** Keep the table mounted while browser Back/Forward controls the selected order. */
export function useOrderSelection(enabled: boolean, currentChainId: number) {
  const params = useSearchParams();
  const orderId = enabled ? params.get("order") || undefined : undefined;
  const chainId = params.has("orderChainId")
    ? Number(params.get("orderChainId"))
    : currentChainId;
  const openedHref = useRef<string | undefined>(undefined);
  const trigger = useRef<HTMLElement | null>(null);

  const select = useCallback((id: string, orderChainId = currentChainId) => {
    trigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const url = new URL(window.location.href);
    url.searchParams.set("order", id);
    url.searchParams.set("orderChainId", String(orderChainId));
    openedHref.current = url.href;
    pushUrlState(url.href);
  }, [currentChainId]);

  const close = useCallback(() => {
    // Return to the table entry when opened here. A direct link must stay on
    // this site when closed, even if its previous history entry is elsewhere.
    if (openedHref.current === window.location.href) {
      openedHref.current = undefined;
      window.history.back();
      return;
    }
    const url = new URL(window.location.href);
    url.searchParams.delete("order");
    url.searchParams.delete("orderChainId");
    window.history.replaceState(window.history.state, "", url);
    window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }));
  }, []);

  const restoreFocus = useCallback((event: Event) => {
    event.preventDefault();
    const target = trigger.current?.isConnected
      ? trigger.current
      : document.querySelector<HTMLElement>("[data-history-page] h1");
    target?.focus({ preventScroll: true });
  }, []);

  return { orderId, chainId, select, close, restoreFocus };
}
