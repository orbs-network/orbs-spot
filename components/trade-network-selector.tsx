"use client";

import { useEffect } from "react";
import { useConnection, useSwitchChain } from "wagmi";
import { toast } from "sonner";
import { MAIN_CHAINS, SPOT_CHAINS, SPOT_TABS } from "@/lib/consts";
import { useSelectedFormTab } from "@/lib/hooks/use-form-tab";
import { cn } from "@/lib/utils";
import { NetworkSelector } from "./network-selector";
import { getNetworkLabel } from "./network-label";

const UNSUPPORTED_CHAIN_TOAST_ID = "unsupported-chain";

export function TradeNetworkSelector() {
  const { chainId: currentChainId, isConnected } = useConnection();
  const switchChain = useSwitchChain();
  const { selectedTab } = useSelectedFormTab();
  const isSpotTab = SPOT_TABS.includes(selectedTab.value as (typeof SPOT_TABS)[number]);
  const availableChains = isSpotTab ? SPOT_CHAINS : MAIN_CHAINS;
  const isWrongNetwork = !availableChains.some(chain => chain.id === currentChainId);
  const currentLabel = isWrongNetwork ? "Wrong network" : currentChainId ? getNetworkLabel(currentChainId) : "Network";

  useEffect(() => {
    if (isConnected && isWrongNetwork && currentChainId) {
      toast.warning(`This chain is not supported by ${selectedTab.fullLabel}`, {
        id: UNSUPPORTED_CHAIN_TOAST_ID,
        description: "Switch to a supported network to continue.",
      });
    } else toast.dismiss(UNSUPPORTED_CHAIN_TOAST_ID);
    return () => { toast.dismiss(UNSUPPORTED_CHAIN_TOAST_ID); };
  }, [currentChainId, isConnected, isWrongNetwork, selectedTab.fullLabel]);

  if (!isConnected) return null;

  return (
    <NetworkSelector
      aria-label={`Select network, current network is ${currentLabel}`}
      chains={availableChains}
      value={isWrongNetwork ? undefined : String(currentChainId)}
      placeholder={currentLabel}
      disabled={switchChain.isPending}
      className={cn("min-h-9 w-auto max-w-full shrink-0 rounded-lg px-2 text-xs sm:max-w-[180px]", isWrongNetwork && "border-destructive/60 text-destructive")}
      onValueChange={value => {
        const chainId = Number(value);
        if (chainId !== currentChainId) switchChain.mutate({ chainId }, {
          onError: () => toast.error("Network switch wasn’t completed. Try again in your wallet."),
        });
      }}
    />
  );
}
