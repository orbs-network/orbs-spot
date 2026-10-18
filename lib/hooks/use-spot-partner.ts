"use client";

import { useCallback } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import type { Partners } from "@orbs-network/spot-ui";
import { getActiveSpotPartner } from "@/lib/partners/spot";
import { parseSpotPartner } from "@/lib/spot/partners";
import { updateUrlSearchParams } from "@/lib/url-state";

export function useSpotPartner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isDebugMode = searchParams.get("debug") === "true";
  const defaultPartner = getActiveSpotPartner();
  const partner = isDebugMode
    ? parseSpotPartner(searchParams.get("partner"), defaultPartner)
    : defaultPartner;
  const setPartner = useCallback((value: Partners) => {
    if (!isDebugMode) return;
    updateUrlSearchParams(pathname, searchParams, params => params.set("partner", value));
  }, [isDebugMode, pathname, searchParams]);

  return { partner, setPartner, isDebugMode };
}
