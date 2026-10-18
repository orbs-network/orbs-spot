"use client";

import { useState } from "react";
import { useConnection, useSwitchChain } from "wagmi";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { OrderStatus, type Order } from "@orbs-network/spot-ui";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useWalletInteractions } from "@/components/advanced-order/hooks";
import { cancelOrderBatch } from "@/lib/spot/cancellation";
import { watchCancelledOrder } from "@/lib/spot/cancel-status";
import { spotClientQueryOptions, spotKeys } from "@/lib/spot/queries";
import { getChainName } from "@/lib/utils";
import { useSpotPartner } from "@/lib/hooks/use-spot-partner";

export function BulkCancelDialog({ orders, onClose }: { orders: Order[]; onClose: () => void }) {
  const { partner } = useSpotPartner();
  const groups = [...Map.groupBy(orders, order => `${order.chainId}:${order.version === 2 ? "v2" : order.historyKey}`).values()];
  const [completed, setCompleted] = useState(0);
  const [failure, setFailure] = useState<string>();
  const group = groups[completed];
  const { address, chainId } = useConnection();
  const wallet = useWalletInteractions();
  const switchChain = useSwitchChain();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationKey: ["spot-bulk-cancellation"],
    mutationFn: async (batch: Order[]) => {
      if (!group || !address) throw new Error("Connect the order’s wallet to cancel");
      const cached = queryClient.getQueryData<Order[]>(spotKeys.orders(partner, "all", address));
      const fresh = batch.map(order => cached?.find(item => item.historyKey === order.historyKey) ?? order).filter(order => order.status === OrderStatus.Open);
      if (fresh.length) {
        const client = await queryClient.fetchQuery(spotClientQueryOptions(partner, group[0].chainId, true));
        await cancelOrderBatch(client, wallet, fresh, address);
      }
      return { orders: fresh, partner, account: address };
    },
    retry: false,
    onSuccess: async result => {
      await Promise.all(result.orders.map(order => watchCancelledOrder(queryClient, { partner: result.partner, chainId: order.chainId, account: result.account, historyKey: order.historyKey }).finished));
      setCompleted(value => value + 1);
      setFailure(undefined);
    },
    onError: error => setFailure(error.message),
  });
  const pending = mutation.isPending || switchChain.isPending;
  const sameWallet = Boolean(address && group?.every(order => order.maker.toLowerCase() === address.toLowerCase()));
  return <Dialog open dismissible={!pending} onOpenChange={open => { if (!open && !pending) onClose(); }}>
    <DialogContent presentation="center" showCloseButton={false} className="max-w-lg p-6" aria-describedby="bulk-cancel-description"
      onEscapeKeyDown={event => { if (pending) event.preventDefault(); }} onPointerDownOutside={event => { if (pending) event.preventDefault(); }}>
      <DialogTitle>{group ? `Cancel ${orders.length} orders?` : "Cancellations confirmed"}</DialogTitle>
      <p id="bulk-cancel-description" className="text-sm text-muted-foreground">Only remaining trades are cancelled. Each network requires a wallet transaction; earlier confirmations remain completed if a later one fails.</p>
      <ul className="space-y-2 text-sm">{groups.map((items, index) => <li key={items[0].historyKey} className="flex justify-between gap-4 rounded-lg bg-secondary p-3"><span>{getChainName(items[0].chainId)} · {items.length} orders</span><span>{index < completed ? "Confirmed" : index === completed ? "Next" : "Waiting"}</span></li>)}</ul>
      {failure && <p role="alert" className="text-sm text-destructive">{failure}</p>}
      {group && !sameWallet && <p role="alert" className="text-sm text-destructive">Connect the wallet that placed these orders.</p>}
      <div className="flex flex-wrap gap-3"><Button variant="outline" disabled={pending} onClick={onClose}>Close</Button>
        {group && <Button disabled={!sameWallet || pending} isLoading={pending} onClick={() => {
          setFailure(undefined);
          if (chainId !== group[0].chainId) switchChain.mutate({ chainId: group[0].chainId }, { onError: error => setFailure(error.message) });
          else mutation.mutate(group);
        }}>{chainId !== group[0].chainId ? `Switch to ${getChainName(group[0].chainId)}` : `Confirm ${group.length} on ${getChainName(group[0].chainId)}`}</Button>}
      </div>
    </DialogContent>
  </Dialog>;
}
