"use client";

import { useMemo } from "react";
import { Partners } from "@orbs-network/spot-ui";
import { SPOT_CHAINS } from "@/lib/consts";
import { getPartnerChains } from "@/lib/spot/partners";
import { useSpotPartner } from "./use-spot-partner";
import { useSpotPartners } from "./use-spot-partners";

/** Known partners use the published network list; SDK configuration handles other identifiers. */
export function useSpotPartnerChains(enabled = true) {
  const { partner, isDebugMode } = useSpotPartner();
  // The public partner list is incomplete for custom identifiers. Do not turn an
  // absent list entry into a claim that the SDK cannot quote on any network.
  const knownPartner = Object.values(Partners).includes(partner);
  const shouldFilter = enabled && knownPartner && (isDebugMode || partner !== Partners.External);
  const query = useSpotPartners(shouldFilter);
  const chains = useMemo(() => {
    const ids = process.env.NEXT_PUBLIC_RPC_CHAIN_IDS;
    const configured = ids ? new Set(ids.split(",").map(Number)) : undefined;
    const available = configured ? SPOT_CHAINS.filter(chain => configured.has(chain.id)) : SPOT_CHAINS;
    return shouldFilter ? getPartnerChains(available, query.data ?? [], partner) : available;
  }, [shouldFilter, query.data, partner]);

  return {
    partner,
    chains,
    isLoading: shouldFilter && !query.data && query.isPending,
    isError: shouldFilter && !query.data && query.isError,
  };
}
