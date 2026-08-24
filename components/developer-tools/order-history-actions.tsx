"use client";

import { lazy, Suspense } from "react";
import type { Order } from "@orbs-network/spot-react";

import { useDeveloperMode } from "./use-developer-mode";

const FetchOrdersDeveloperButtonContent = lazy(async () => ({
  default: (await import("./order-history-actions-content"))
    .FetchOrdersDeveloperButtonContent,
}));

const CancelOrderDeveloperButtonContent = lazy(async () => ({
  default: (await import("./order-history-actions-content"))
    .CancelOrderDeveloperButtonContent,
}));

export function FetchOrdersDeveloperButton({ orders }: { orders: Order[] }) {
  const { isDeveloperMode } = useDeveloperMode();

  return isDeveloperMode ? (
    <Suspense fallback={null}>
      <FetchOrdersDeveloperButtonContent orders={orders} />
    </Suspense>
  ) : null;
}

export function CancelOrderDeveloperButton({
  rawOrder,
  title,
}: {
  rawOrder: Order;
  title: string;
}) {
  const { isDeveloperMode } = useDeveloperMode();

  return isDeveloperMode ? (
    <Suspense fallback={null}>
      <CancelOrderDeveloperButtonContent rawOrder={rawOrder} title={title} />
    </Suspense>
  ) : null;
}
