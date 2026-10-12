"use client";

import { useState } from "react";
import { OrderStatus, type Order } from "@orbs-network/spot-ui";
import { useConnection, useSwitchChain } from "wagmi";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getNetworkLabel } from "@/components/network-label";
import { useCancelOrder } from "@/components/advanced-order/use-order-client";
import { useWalletConnectModal } from "@/features/wallet-connection/provider";
import { useOrderCancelling } from "@/lib/spot/use-order-cancelling";
import { CancelOrderDialog } from "./cancel-order-dialog";
import styles from "./order-page.module.css";

export function DirectOrderCancelAction({ order, className }: { order: Order; className?: string }) {
  const { address, chainId } = useConnection();
  const { cancelOrder, isLoading } = useCancelOrder(order);
  const switchChain = useSwitchChain();
  const isOwner = address?.toLowerCase() === order.maker.toLowerCase();
  const wrongNetwork = chainId !== order.chainId;
  const pending = isLoading || switchChain.isPending;
  if (order.status !== OrderStatus.Open || !isOwner) return null;
  return <Button className={className ?? "min-h-11 shrink-0"} isLoading={pending} disabled={pending} onClick={() => {
    if (pending) return;
    if (wrongNetwork) {
      switchChain.mutate({ chainId: order.chainId }, { onError: () => toast.error("Network switch wasn’t completed. Try again in your wallet.") });
    } else cancelOrder();
  }}>{wrongNetwork ? `Switch to ${getNetworkLabel(order.chainId)} to cancel` : "Cancel order"}</Button>;
}

export function OrderCancelAction({ order, className }: { order: Order; className?: string }) {
  const { address } = useConnection();
  const isCancelling = useOrderCancelling(order);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const isOwner = address?.toLowerCase() === order.maker.toLowerCase();
  if (order.status !== OrderStatus.Open || !isOwner) return null;
  return <>
    <Button className={className ?? "min-h-11 shrink-0"} isLoading={isCancelling} disabled={isCancelling} onClick={() => setConfirmCancel(true)}>Cancel order</Button>
    {confirmCancel && <CancelOrderDialog order={order} onClose={() => setConfirmCancel(false)} />}
  </>;
}

export function OrderActions({ order }: { order: Order }) {
  const { address } = useConnection();
  const { openConnectModal } = useWalletConnectModal();
  const isOwner = address?.toLowerCase() === order.maker.toLowerCase();
  if (order.status !== OrderStatus.Open) return null;
  return <div className={styles.actions}>
    {isOwner ? <>
      <p className={styles.caption}>Need to stop this order? You can cancel its remaining trades.</p>
      <OrderCancelAction order={order} />
    </> : <>
      <p className={styles.caption}>Only the wallet that placed this order can cancel it.</p>
      {!address && <Button variant="outline" className="min-h-11 shrink-0" onClick={() => openConnectModal?.()}>Connect wallet</Button>}
    </>}
  </div>;
}
