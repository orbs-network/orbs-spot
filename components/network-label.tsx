import { CHAIN_LOGO_URLS, robinhoodChain } from "@/lib/consts";
import { getChainName } from "@/lib/utils";
import { arbitrum, avalanche, bsc } from "viem/chains";

const NETWORK_SHORT_NAMES: Partial<Record<number, string>> = {
  [bsc.id]: "BSC",
  [arbitrum.id]: "Arbitrum",
  [avalanche.id]: "Avalanche",
  [robinhoodChain.id]: "Robinhood",
};

export function getNetworkLabel(chainId: number) {
  return NETWORK_SHORT_NAMES[chainId] ?? (getChainName(chainId) || `Chain ${chainId}`);
}

export function NetworkLabel({ chainId }: { chainId: number }) {
  const logo = CHAIN_LOGO_URLS[chainId as keyof typeof CHAIN_LOGO_URLS];
  const fullName = getChainName(chainId) || `Chain ${chainId}`;
  return (
    <span title={fullName} className="inline-flex min-w-0 items-center gap-2 align-middle leading-none whitespace-nowrap">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {logo && <img data-network-logo src={logo} alt="" width={20} height={20} className="block size-5 shrink-0 rounded-full object-contain" />}
      <span data-network-name className="min-w-0 truncate leading-5">{getNetworkLabel(chainId)}</span>
    </span>
  );
}
