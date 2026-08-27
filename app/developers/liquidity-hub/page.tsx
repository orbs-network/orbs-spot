import type { Metadata } from "next";

import { LiquidityHubGuide } from "@/components/developer-tools/liquidity-hub-guide";

export const metadata: Metadata = {
  title: "Liquidity Hub integration guide",
  description:
    "Integrate Orbs Liquidity Hub quote comparison, Permit2 approval, EIP-712 signing, swap execution, and transaction tracking.",
};

export default function LiquidityHubGuidePage() {
  return <LiquidityHubGuide />;
}
