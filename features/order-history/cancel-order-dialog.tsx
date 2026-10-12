"use client";

import { useId, useRef } from "react";
import { Trash2Icon } from "lucide-react";
import { OrderStatus, type Order } from "@orbs-network/spot-ui";
import { useConnection, useSwitchChain } from "wagmi";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { getNetworkLabel, NetworkLabel } from "@/components/network-label";
import { useCancelOrder } from "@/components/advanced-order/use-order-client";
import { useOrderCancelling } from "@/lib/spot/use-order-cancelling";
import { getOrderTypeLabel } from "./format";
import { CopyableIdentifier } from "./order-overview";

export function OrderCancelButton({ order, onCancel }: { order: Order; onCancel: (order: Order) => void }) {
  const pending = useOrderCancelling(order);
  if (order.status !== OrderStatus.Open) return null;
  return <Tooltip action>
    <TooltipTrigger asChild>
      <button data-icon-button type="button" data-order-cancel-trigger disabled={pending} aria-busy={pending} onClick={() => onCancel(order)} aria-label={pending ? `Cancelling order ${order.id}` : `Cancel ${getOrderTypeLabel(order.type)} order ${order.id}`} className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-destructive disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-primary">
        {pending ? <Spinner aria-hidden="true" className="size-4" /> : <Trash2Icon aria-hidden="true" className="size-4" />}
      </button>
    </TooltipTrigger>
    <TooltipContent>{pending ? "Cancelling…" : "Cancel order"}</TooltipContent>
  </Tooltip>;
}

/** The row action only opens this confirmation; writes require the second click. */
export function CancelOrderDialog({ order, onClose }: { order: Order; onClose: () => void }) {
  const { address, chainId } = useConnection();
  const { cancelOrder, isLoading } = useCancelOrder(order);
  const switchChain = useSwitchChain();
  const keepButton = useRef<HTMLButtonElement>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const descriptionId = useId();
  const sameWallet = Boolean(address && order.maker.toLowerCase() === address.toLowerCase());
  const wrongNetwork = chainId !== order.chainId;
  const pending = isLoading || switchChain.isPending;
  const canCancel = sameWallet && order.status === OrderStatus.Open && !pending;

  return <Dialog open dismissible={!pending} onOpenChange={open => { if (!open && !pending) onClose(); }}>
    <DialogContent data-cancel-order-dialog aria-describedby={descriptionId} presentation="center" showCloseButton={false} className="max-w-[440px] gap-5 p-6"
      onOpenAutoFocus={event => { event.preventDefault(); trigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; keepButton.current?.focus(); }}
      onCloseAutoFocus={event => { event.preventDefault(); const target = trigger.current?.isConnected ? trigger.current : document.querySelector<HTMLElement>("[data-history-page] h1, #floating-open-orders-title"); target?.focus({ preventScroll: true }); }}>
      <DialogTitle>Cancel this order?</DialogTitle>
      <p id={descriptionId} className="text-sm text-muted-foreground">Remaining trades will stop once cancellation is confirmed. Trades already filled are unchanged.</p>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-2xl bg-secondary p-4 text-sm">
        <div className="flex min-w-0 items-center gap-2"><span className="shrink-0 text-muted-foreground">Order ID</span><CopyableIdentifier value={order.id} label="order ID" /></div>
        <NetworkLabel chainId={order.chainId} />
      </div>
      {!sameWallet && <p role="alert" className="text-sm text-destructive">Connect the wallet that placed this order to cancel it.</p>}
      <div className="flex flex-wrap gap-3">
        <Button ref={keepButton} variant="outline" className="min-h-11 flex-1" disabled={pending} onClick={onClose}>Close</Button>
        <Button className="min-h-11 flex-1" disabled={!canCancel} isLoading={pending} onClick={() => {
          if (!canCancel) return;
          if (wrongNetwork) {
            switchChain.mutate({ chainId: order.chainId }, { onError: () => toast.error("Network switch wasn’t completed. Try again in your wallet.") });
          } else cancelOrder(undefined, { onSuccess: onClose });
        }}>{wrongNetwork ? `Switch to ${getNetworkLabel(order.chainId)}` : "Confirm"}</Button>
      </div>
    </DialogContent>
  </Dialog>;
}
