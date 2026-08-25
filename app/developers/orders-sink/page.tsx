import type { Metadata } from "next";

import { OrdersSinkGuide } from "@/components/developer-tools/orders-sink-guide";

export const metadata: Metadata = {
  title: "Orders Sink integration guide",
  description:
    "Implement Orders Sink configuration, token approval, EIP-712 signing, order submission, history, and cancellation.",
};

export default function OrdersSinkGuidePage() {
  return <OrdersSinkGuide />;
}
