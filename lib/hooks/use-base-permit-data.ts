import { useQuery } from "@tanstack/react-query";
import {
  isAddress,
  isAddressEqual,
  zeroAddress,
  type Address,
} from "viem";

import { getActiveSpotPartner } from "@/lib/partners/spot";

const ORDER_SINK_CONFIG_URL =
  "https://order-sink-v2.orbs.network/config";

export type BasePermitData = {
  domain: {
    chainId: number;
    name: string;
    verifyingContract: Address;
    version: string;
  };
  order: {
    witness: {
      chainid: number;
      exchange: {
        adapter: Address;
      };
    };
  };
};

export async function getBasePermitData({
  chainId,
  partner,
  signal,
}: {
  chainId: number;
  partner: string;
  signal?: AbortSignal;
}) {
  const response = await fetch(
    `${ORDER_SINK_CONFIG_URL}?partner=${encodeURIComponent(partner)}&chain=${chainId}`,
    {
      headers: { Accept: "application/json" },
      signal,
    },
  );

  if (!response.ok) {
    throw new Error(
      `Failed to fetch base permit data (${response.status})`,
    );
  }

  const basePermitData = (await response.json()) as BasePermitData;

  if (
    !isAddress(basePermitData.domain?.verifyingContract) ||
    !isAddress(basePermitData.order?.witness?.exchange?.adapter) ||
    isAddressEqual(basePermitData.domain.verifyingContract, zeroAddress) ||
    isAddressEqual(basePermitData.order.witness.exchange.adapter, zeroAddress)
  ) {
    throw new Error("Base permit data is missing contract addresses");
  }

  if (
    basePermitData.domain.chainId !== chainId ||
    basePermitData.order.witness.chainid !== chainId
  ) {
    throw new Error("Base permit data does not match the selected chain");
  }

  return basePermitData;
}

export function useBasePermitData(chainId?: number) {
  const partner = getActiveSpotPartner();

  return useQuery({
    queryKey: ["base-permit-data", partner, chainId],
    queryFn: ({ signal }) =>
      getBasePermitData({ chainId: chainId!, partner, signal }),
    enabled: Boolean(chainId),
    staleTime: Infinity,
  });
}
