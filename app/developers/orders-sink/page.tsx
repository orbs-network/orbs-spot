import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Advanced Orders Docs — Direct API",
  description:
    "Integrate Orbs Advanced Orders directly through the Order Sink APIs.",
};

export default function OrdersSinkGuidePage() {
  redirect("/developers/orders-sink/direct");
}
