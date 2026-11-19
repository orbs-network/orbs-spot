"use client";

import { useQuery } from "@tanstack/react-query";
import { spotClientQueryOptions } from "@/lib/spot/queries";
import { useDataChainId } from "./use-data-chain-id";
import { useSpotPartnerChains } from "./use-spot-partner-chains";
import { useDeveloperMode } from "./use-developer-mode";
import { useSpotApiUrl } from "./use-spot-api-url";

export function useSpotSwapClient(enabled = true) {
  const chainId = useDataChainId();
  const { partner, chains } = useSpotPartnerChains(enabled);
  const { isDeveloperPlayground } = useDeveloperMode();
  const apiUrl = useSpotApiUrl();
  return useQuery({
    ...spotClientQueryOptions(partner, chainId, isDeveloperPlayground, apiUrl),
    enabled: enabled && chains.some(chain => chain.id === chainId),
  });
}
