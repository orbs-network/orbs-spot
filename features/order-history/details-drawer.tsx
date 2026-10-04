"use client";

import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { XIcon } from "lucide-react";
import { useRef } from "react";
import type { Order } from "@orbs-network/spot-ui";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { SPOT_CHAINS } from "@/lib/consts";
import { getChainName } from "@/lib/utils";
import { useWalletConnectModal } from "@/features/wallet-connection/provider";
import { SelectedOrderDetails } from "./details";
import { HistoryPresentation } from "./presentation";

export function OrderDetailsDrawer({
  orderId, order, chainId, hasWallet, loading, error,
  onClose, onRetry, onCloseAutoFocus,
}: {
  orderId?: string;
  order?: Order;
  chainId: number;
  hasWallet: boolean;
  loading: boolean;
  error: Error | null;
  onClose: () => void;
  onRetry: () => void;
  onCloseAutoFocus: (event: Event) => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const { openConnectModal } = useWalletConnectModal();
  const supportedChain = SPOT_CHAINS.some(chain => chain.id === chainId);
  const chainName = getChainName(chainId) || "Unknown network";

  let content;
  if (!supportedChain) {
    content = <p role="alert">This order link uses an unsupported network.</p>;
  } else if (!hasWallet) {
    content = <><p>Connect the wallet that placed this order to view its details.</p><Button onClick={() => openConnectModal?.()}>Connect wallet</Button></>;
  } else if (order) {
    content = <SelectedOrderDetails key={order.historyKey} rawOrder={order} onBack={onClose} />;
  } else if (loading) {
    content = <div role="status" className="flex items-center gap-3"><Spinner className="size-5" />Loading order details…</div>;
  } else if (error) {
    content = <><p role="alert">Could not load this order.</p><Button variant="outline" onClick={onRetry}>Retry</Button></>;
  } else {
    content = <><p>Order not found for this wallet on {chainName}.</p><p className="text-muted-foreground">Check that you’ve connected the wallet that placed the order.</p><Button variant="outline" onClick={onClose}>Back to order history</Button></>;
  }

  return (
    <Dialog open={Boolean(orderId)} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent
        data-order-details-drawer
        showCloseButton={false}
        aria-describedby={undefined}
        onOpenAutoFocus={event => { event.preventDefault(); heading.current?.focus(); }}
        onCloseAutoFocus={onCloseAutoFocus}
        onPointerDownOutside={event => {
          // Toast actions belong to the open drawer flow, not its backdrop.
          if (event.target instanceof Element && event.target.closest("[data-sonner-toaster]")) {
            event.preventDefault();
          }
        }}
      >
        <header data-order-details-header>
          <div className="min-w-0">
            <DialogTitle ref={heading} tabIndex={-1}>Order details</DialogTitle>
            <p className="mt-1 text-xs text-muted-foreground">{chainName}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <DialogClose asChild><Button variant="ghost" size="icon" aria-label="Close order details"><XIcon aria-hidden="true" /></Button></DialogClose>
          </div>
        </header>
        <div data-order-details-body>
          <HistoryPresentation.Provider value="drawer">
            {order && supportedChain && hasWallet
              ? content
              : <div className="flex flex-col items-start gap-4 p-6 text-sm">{content}</div>}
          </HistoryPresentation.Provider>
        </div>
      </DialogContent>
    </Dialog>
  );
}
