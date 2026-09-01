import type { Metadata } from "next";

import { DeveloperGuidePage } from "@/features/developer-docs/developer-guide-page";

export const metadata: Metadata = {
  title: "Advanced Orders Docs — React SDK",
  description:
    "Integrate Advanced Orders into a React DEX with SpotProvider, useSpot, wallet adapters, progress UI, and order history.",
};

export default function AdvancedOrdersReactGuidePage() {
  return <DeveloperGuidePage activeGuideId="advanced-orders-react" />;
}
