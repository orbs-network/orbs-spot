import { notFound } from "next/navigation";
import { getActivePartnerConfig } from "@/lib/partners/server";
import { OrdersWorkspace } from "@/components/orders-workspace";

export default function OrdersPage() {
  if (getActivePartnerConfig().id !== "orbs") notFound();
  return <OrdersWorkspace />;
}
