"use client";

import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { XIcon } from "lucide-react";
import { useRef } from "react";
import { useOrderPreview, type OrderPreviewOptions } from "./use-order-preview";
import { Button } from "@/components/ui/button";
import { NetworkLabel } from "@/components/network-label";
import { Spinner } from "@/components/ui/spinner";
import { useWalletConnectModal } from "@/features/wallet-connection/provider";
import { OrderTransactionDetails } from "./transaction-details";
import { HistoryPresentation } from "./presentation";

export function OrderDetailsModal({
  orderId, order: suppliedOrder, chainId, hasWallet, loading: suppliedLoading, error: suppliedError,
  onClose, onRetry, onCloseAutoFocus,
}: OrderPreviewOptions & {
  onClose: () => void;
  onRetry?: () => void;
  onCloseAutoFocus: (event: Event) => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const { openConnectModal } = useWalletConnectModal();
  const { preview, supportedChain, chainName, refetch } = useOrderPreview({
    orderId, order: suppliedOrder, chainId, hasWallet, loading: suppliedLoading, error: suppliedError,
  });
  const { order, loading, error, canRead } = preview;

  let content;
  if (!supportedChain) {
    content = <p role="alert">This order link uses an unsupported network.</p>;
  } else if (!canRead) {
    content = <><p>Connect the wallet that placed this order to view its details.</p><Button onClick={() => openConnectModal?.()}>Connect wallet</Button></>;
  } else if (order) {
    content = <OrderTransactionDetails key={order.historyKey} order={order} />;
  } else if (loading) {
    content = <div role="status" className="flex items-center gap-3"><Spinner className="size-5" />Loading order details…</div>;
  } else if (error) {
    content = <><p role="alert">Could not load this order.</p><Button variant="outline" onClick={() => { onRetry?.(); void refetch(); }}>Retry</Button></>;
  } else {
    content = <><p>Order not found for this wallet on {chainName}.</p><p className="text-muted-foreground">Check that you’ve connected the wallet that placed the order.</p><Button variant="outline" onClick={onClose}>Back to order history</Button></>;
  }

  return (
    <Dialog open={Boolean(orderId)} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent
        data-order-details-modal
        data-order-preview
        className="max-w-[520px]"
        presentation="center"
        showCloseButton={false}
        aria-describedby={undefined}
        onOpenAutoFocus={event => { event.preventDefault(); heading.current?.focus(); }}
        onCloseAutoFocus={onCloseAutoFocus}
        onPointerDownOutside={event => {
          // Toast actions belong to the open preview flow, not its backdrop.
          if (event.target instanceof Element && event.target.closest("[data-sonner-toaster]")) {
            event.preventDefault();
          }
        }}
      >
        <header data-order-details-header>
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            <DialogTitle ref={heading} tabIndex={-1} className="shrink-0">Order details</DialogTitle>
            {supportedChain && <span className="min-w-0 text-xs font-normal text-muted-foreground"><NetworkLabel chainId={preview.chainId} /></span>}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <DialogClose asChild><Button variant="ghost" size="icon" aria-label="Close order details"><XIcon aria-hidden="true" /></Button></DialogClose>
          </div>
        </header>
        <div data-order-details-body data-vaul-no-drag>
          <HistoryPresentation.Provider value="modal">
            {order && supportedChain && canRead
              ? content
              : <div className="flex flex-col items-start gap-4 p-6 text-sm">{content}</div>}
          </HistoryPresentation.Provider>
        </div>
      </DialogContent>
    </Dialog>
  );
}
