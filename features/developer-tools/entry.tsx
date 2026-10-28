"use client";

import dynamic from "next/dynamic";
import { useDeveloperMode } from "@/lib/hooks/use-developer-mode";
import { useIsSwapTab } from "@/lib/hooks/use-form-tab";
import type { ComponentType } from "react";

// All tools mount only inside /dev; debug=true on the main UI enables partner testing only.
function withDeveloperMode<Props extends object>(Component: ComponentType<Props>) {
  return function DeveloperComponent(props: Props) {
    const { isDeveloperPlayground } = useDeveloperMode();
    return isDeveloperPlayground ? <Component {...props} /> : null;
  };
}
const PlaygroundQuoteTrigger = dynamic(() => import("./spot-swap-developer-trigger").then(m => m.SpotSwapQuoteDeveloperTrigger), { ssr: false });
export function SpotSwapQuoteDeveloperTrigger() {
  const { isDeveloperPlayground } = useDeveloperMode();
  const isSwapTab = useIsSwapTab();
  return isDeveloperPlayground && isSwapTab ? <PlaygroundQuoteTrigger /> : null;
}
export const SpotSwapDeveloperTrigger = withDeveloperMode(dynamic(() => import("./spot-swap-developer-trigger").then(m => m.SpotSwapDeveloperTrigger), { ssr: false }));
export const LiveOrderFlowTrigger = withDeveloperMode(dynamic(() => import("./live-order-flow-trigger").then(m => m.LiveOrderFlowTrigger), { ssr: false }));
export const FetchOrdersDeveloperButton = withDeveloperMode(dynamic(() => import("./order-history-actions").then(m => m.FetchOrdersDeveloperButton), { ssr: false }));
export const CancelOrderDeveloperButton = withDeveloperMode(dynamic(() => import("./order-history-actions").then(m => m.CancelOrderDeveloperButton), { ssr: false }));
export const DeveloperNavigation = withDeveloperMode(dynamic(() => import("./navigation").then(m => m.DeveloperNavigation), { ssr: false }));
export const DeveloperMoreNavigation = withDeveloperMode(dynamic(() => import("./navigation").then(m => m.DeveloperMoreNavigation), { ssr: false }));
