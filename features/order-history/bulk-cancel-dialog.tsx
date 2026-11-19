"use client";

import { useState } from "react";
import { useConnection, useSwitchChain } from "wagmi";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { OrderStatus, type Partners } from "@orbs-network/spot-ui";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useWalletInteractions } from "@/components/advanced-order/hooks";
import { cancelOrderBatch } from "@/lib/spot/cancellation";
import { watchCancelledOrder } from "@/lib/spot/cancel-status";
import { spotClientQueryOptions, spotKeys } from "@/lib/spot/queries";
import { getChainName } from "@/lib/utils";
import { useSpotPartner } from "@/lib/hooks/use-spot-partner";
import { useSpotApiUrl } from "@/lib/hooks/use-spot-api-url";
import type { HistoryOrder } from "@/lib/spot/order-tokens";
import type { SpotWalletPort } from "@/lib/spot/execution";

type BatchCancellationInput = { orders: HistoryOrder[]; partner: Partners; apiUrl: string; account: string; wallet: SpotWalletPort };

export function BulkCancelDialog({ orders, onClose }: { orders: HistoryOrder[]; onClose: () => void }) {
  const { partner } = useSpotPartner();
  const selectedApiUrl = useSpotApiUrl();
  const groups = [...Map.groupBy(orders, order => `${order.apiUrl ?? selectedApiUrl}:${order.chainId}:${order.version === 2 ? "v2" : order.historyKey}`).values()];
  const [completed, setCompleted] = useState(0);
  const [failure, setFailure] = useState<string>();
  const group = groups[completed];
  const apiUrl = group?.[0].apiUrl ?? selectedApiUrl;
  const { address, chainId } = useConnection();
  const wallet = useWalletInteractions();
  const switchChain = useSwitchChain();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationKey: ["spot-bulk-cancellation", apiUrl, partner],
    mutationFn: async ({ orders: batch, partner, apiUrl, account, wallet }: BatchCancellationInput) => {
      if (!batch.length) throw new Error("No orders selected");
      const cached = queryClient.getQueryData<HistoryOrder[]>(spotKeys.orders(partner, "all", account, apiUrl));
      const fresh = batch.map(order => cached?.find(item => item.chainId === order.chainId && item.historyKey === order.historyKey) ?? order).filter(order => order.status === OrderStatus.Open);
      if (fresh.length) {
        const client = await queryClient.fetchQuery(spotClientQueryOptions(partner, batch[0].chainId, true, apiUrl));
        await cancelOrderBatch(client, wallet, fresh, account);
      }
      return { orders: fresh, partner, account, apiUrl };
    },
    retry: false,
    onSuccess: async result => {
      await Promise.all(result.orders.map(order => watchCancelledOrder(queryClient, { partner: result.partner, apiUrl: result.apiUrl, chainId: order.chainId, account: result.account, historyKey: order.historyKey }).finished));
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
          else if (address) mutation.mutate({ orders: group, partner, apiUrl, account: address, wallet });
        }}>{chainId !== group[0].chainId ? `Switch to ${getChainName(group[0].chainId)}` : `Confirm ${group.length} on ${getChainName(group[0].chainId)}`}</Button>}
      </div>
    </DialogContent>
  </Dialog>;
}
