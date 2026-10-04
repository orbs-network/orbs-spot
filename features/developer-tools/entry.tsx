"use client";

import dynamic from "next/dynamic";

// This entry is replaced with disabled.tsx for partner builds. Keep examples,
// inspectors and simulations behind this boundary, never in trading modules.
export const LiquidityHubDeveloperTrigger = dynamic(() => import("./liquidity-hub-developer-trigger").then(m => m.LiquidityHubDeveloperTrigger), { ssr: false });
export const LiquidityHubQuoteDeveloperTrigger = dynamic(() => import("./liquidity-hub-developer-trigger").then(m => m.LiquidityHubQuoteDeveloperTrigger), { ssr: false });
export const LiveOrderFlowTrigger = dynamic(() => import("./live-order-flow-trigger").then(m => m.LiveOrderFlowTrigger), { ssr: false });
export const FetchOrdersDeveloperButton = dynamic(() => import("./order-history-actions").then(m => m.FetchOrdersDeveloperButton), { ssr: false });
export const CancelOrderDeveloperButton = dynamic(() => import("./order-history-actions").then(m => m.CancelOrderDeveloperButton), { ssr: false });
export const DeveloperNavigation = dynamic(() => import("./navigation").then(m => m.DeveloperNavigation), { ssr: false });
export const DeveloperMoreNavigation = dynamic(() => import("./navigation").then(m => m.DeveloperMoreNavigation), { ssr: false });
