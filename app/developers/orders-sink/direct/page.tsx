import type { Metadata } from "next";

import { DeveloperGuidePage } from "@/features/developer-docs/developer-guide-page";

export const metadata: Metadata = {
  title: "Advanced Orders Docs — Direct API",
  description:
    "Integrate Advanced Orders directly through the Order Sink APIs without installing an Orbs package.",
};

export default function AdvancedOrdersDirectGuidePage() {
  return <DeveloperGuidePage activeGuideId="advanced-orders-core" />;
}
