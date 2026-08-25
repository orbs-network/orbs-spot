"use client";

import { lazy, Suspense } from "react";
import type { Order } from "@orbs-network/spot-react";
import { useConnection } from "wagmi";

import { useDeveloperMode } from "./use-developer-mode";

const FetchOrdersDeveloperButtonContent = lazy(async () => ({
  default: (await import("./order-history-actions-content"))
    .FetchOrdersDeveloperButtonContent,
}));

const CancelOrderDeveloperButtonContent = lazy(async () => ({
  default: (await import("./order-history-actions-content"))
    .CancelOrderDeveloperButtonContent,
}));

export function FetchOrdersDeveloperButton({
  isLoading,
  orders,
}: {
  isLoading?: boolean;
  orders: Order[];
}) {
  const { isDeveloperMode } = useDeveloperMode();
  const { address } = useConnection();

  return isDeveloperMode && address ? (
    <Suspense fallback={null}>
      <FetchOrdersDeveloperButtonContent
        isLoading={isLoading}
        orders={orders}
      />
    </Suspense>
  ) : null;
}

export function CancelOrderDeveloperButton({
  isCancelling,
  onCancel,
  rawOrder,
}: {
  isCancelling: boolean;
  onCancel: () => Promise<unknown>;
  rawOrder: Order;
}) {
  const { isDeveloperMode } = useDeveloperMode();
  const { address } = useConnection();

  return isDeveloperMode && address ? (
    <Suspense fallback={null}>
      <CancelOrderDeveloperButtonContent
        isCancelling={isCancelling}
        onCancel={onCancel}
        rawOrder={rawOrder}
      />
    </Suspense>
  ) : null;
}
