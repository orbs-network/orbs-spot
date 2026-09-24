import type { Metadata } from "next";
import { Eip712Inspector } from "@/features/eip712-inspector/inspector";

export const metadata: Metadata = { title: "Order preview | Orbs Spot" };

export default function Eip712InspectorPage() {
  return <Eip712Inspector />;
}
