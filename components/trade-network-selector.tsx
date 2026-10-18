"use client";

import { useEffect } from "react";
import { useConnection, useSwitchChain } from "wagmi";
import { toast } from "sonner";
import { MAIN_CHAINS, SPOT_TABS } from "@/lib/consts";
import { useSelectedFormTab } from "@/lib/hooks/use-form-tab";
import { cn } from "@/lib/utils";
import { NetworkSelector } from "./network-selector";
import { getNetworkLabel } from "./network-label";
import { useSpotPartnerChains } from "@/lib/hooks/use-spot-partner-chains";
import { compactSelectorTriggerClass } from "./ui/selector-trigger";

const UNSUPPORTED_CHAIN_TOAST_ID = "unsupported-chain";

export function TradeNetworkSelector() {
  const { chainId: currentChainId, isConnected } = useConnection();
  const switchChain = useSwitchChain();
  const { selectedTab } = useSelectedFormTab();
  const isSpotTab = SPOT_TABS.includes(selectedTab.value as (typeof SPOT_TABS)[number]);
  const { chains: partnerChains, partner, isLoading, isError } = useSpotPartnerChains(isSpotTab);
  const availableChains = isSpotTab ? partnerChains : MAIN_CHAINS;
  const isWrongNetwork = !isLoading && !isError && !availableChains.some(chain => chain.id === currentChainId);
  const currentLabel = isLoading ? "Loading networks…" : isError ? "Networks unavailable" :
    isWrongNetwork ? "Wrong network" : currentChainId ? getNetworkLabel(currentChainId) : "Network";

  useEffect(() => {
    if (isConnected && isWrongNetwork && currentChainId) {
      toast.warning(isSpotTab ? `This chain is not supported by ${partner}` : `This chain is not supported by ${selectedTab.fullLabel}`, {
        id: UNSUPPORTED_CHAIN_TOAST_ID,
        description: "Switch to a supported network to continue.",
      });
    } else toast.dismiss(UNSUPPORTED_CHAIN_TOAST_ID);
    return () => { toast.dismiss(UNSUPPORTED_CHAIN_TOAST_ID); };
  }, [currentChainId, isConnected, isWrongNetwork, selectedTab.fullLabel, isSpotTab, partner]);

  if (!isConnected) return null;

  return (
    <NetworkSelector
      aria-label={`Select network, current network is ${currentLabel}`}
      chains={availableChains}
      value={isWrongNetwork ? undefined : String(currentChainId)}
      placeholder={currentLabel}
      disabled={switchChain.isPending || isLoading || isError}
      className={cn(compactSelectorTriggerClass, isWrongNetwork && "border-destructive/60 text-destructive")}
      onValueChange={value => {
        const chainId = Number(value);
        if (chainId !== currentChainId) switchChain.mutate({ chainId }, {
          onError: () => toast.error("Network switch wasn’t completed. Try again in your wallet."),
        });
      }}
    />
  );
}
