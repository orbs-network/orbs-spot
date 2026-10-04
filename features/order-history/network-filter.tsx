"use client";

import { NetworkSelector } from "@/components/network-selector";
import { SPOT_CHAINS } from "@/lib/consts";

export function NetworkFilter({ value, onValueChange }: {
  value: string;
  onValueChange: (value: string) => void;
}) {
  return <NetworkSelector aria-label="Filter networks" chains={SPOT_CHAINS} value={value} onValueChange={onValueChange} includeAllNetworks />;
}
