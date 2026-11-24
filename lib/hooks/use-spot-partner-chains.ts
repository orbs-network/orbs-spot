"use client";

import { useMemo } from "react";
import { Partners } from "@orbs-network/spot-ui";
import { SPOT_CHAINS } from "@/lib/consts";
import { getPartnerChains } from "@/lib/spot/partners";
import { useSpotPartner } from "./use-spot-partner";
import { useSpotPartners } from "./use-spot-partners";

/** Non-default partners use only networks configured for that integration. */
export function useSpotPartnerChains(enabled = true) {
  const { partner, isDebugMode } = useSpotPartner();
  const shouldFilter = enabled && (isDebugMode || partner !== Partners.External);
  const query = useSpotPartners(shouldFilter);
  const chains = useMemo(() => shouldFilter
    ? getPartnerChains(SPOT_CHAINS, query.data ?? [], partner)
    : SPOT_CHAINS, [shouldFilter, query.data, partner]);

  return {
    partner,
    chains,
    isLoading: shouldFilter && !query.data && query.isPending,
    isError: shouldFilter && !query.data && query.isError,
  };
}
