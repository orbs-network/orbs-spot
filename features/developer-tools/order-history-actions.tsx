"use client";

import { lazy, Suspense } from "react";
import type { Order } from "@orbs-network/spot-ui";
import { useConnection } from "wagmi";
import { useDeveloperMode } from "@/lib/hooks/use-developer-mode";

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
  const { isDeveloperPlayground } = useDeveloperMode();
  const { address } = useConnection();

  return isDeveloperPlayground && address ? (
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
  onCancel: () => void;
  rawOrder: Order;
}) {
  const { isDeveloperPlayground } = useDeveloperMode();
  const { address } = useConnection();

  return isDeveloperPlayground && address ? (
    <Suspense fallback={null}>
      <CancelOrderDeveloperButtonContent
        isCancelling={isCancelling}
        onCancel={onCancel}
        rawOrder={rawOrder}
      />
    </Suspense>
  ) : null;
}
