"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { OrderStatus, type Order } from "@orbs-network/spot-ui";
import { useConnection, useSwitchChain } from "wagmi";
import { AlertTriangleIcon, ArrowDownIcon, CheckIcon, Clock3Icon, ExternalLinkIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { useCancelOrder } from "@/components/advanced-order/use-order-client";
import { getNetworkLabel, NetworkLabel } from "@/components/network-label";
import { Button } from "@/components/ui/button";
import { CurrencyLogo } from "@/components/ui/currency-logo";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { getActiveSpotPartner } from "@/lib/partners/spot";
import { spotOrdersQueryOptions } from "@/lib/spot/queries";
import { acquireSubmissionLock, isSubmissionBusy, subscribeSubmissionLock } from "@/lib/spot/submission-lock";
import { useSubmissionPreview, type SubmissionPreview } from "@/lib/submission-preview";
import { getExplorerUrl, toAmountUI } from "@/lib/utils";
import { getOrderHref } from "@/lib/spot/order-link";
import { formatDisplayAmount } from "@/lib/token-display";
import styles from "./submission-preview-dialog.module.css";

type PreviewAsset = NonNullable<SubmissionPreview["input"]>;

function AssetAmount({ asset, label }: { asset: PreviewAsset; label: string }) {
  return <div data-submission-preview-asset className="flex min-w-0 items-center gap-3">
    <CurrencyLogo symbol={asset.token.symbol} name={asset.token.name} logoUrl={asset.token.logoUrl} className="size-10 shrink-0" />
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p translate="no" title={asset.amount ? `${asset.amount} ${asset.token.symbol ?? "Token"}` : undefined} className="mt-1 text-xl font-medium leading-snug tabular-nums [overflow-wrap:anywhere]">
        {asset.amount && <>{formatDisplayAmount(asset.amount)} </>}{asset.token.symbol ?? "Token"}
      </p>
    </div>
  </div>;
}

function getStatus(preview: SubmissionPreview, order?: Order, cancelling = false) {
  if (cancelling) return { state: "pending" as const, label: "Cancelling order…" };
  if (order?.status === OrderStatus.Cancelled) return { state: "closed" as const, label: "Order cancelled" };
  if (order?.status === OrderStatus.Expired) return { state: "closed" as const, label: "Order expired" };
  if (order?.status === OrderStatus.Completed) return { state: "success" as const, label: preview.kind === "swap" ? "Swap complete" : "Order filled" };
  if (preview.status === "error") return { state: "error" as const, label: preview.title };
  if (order?.status === OrderStatus.Open) return {
    state: "pending" as const,
    label: preview.kind === "swap" ? "Swap in progress" : order.fills.length ? "Partially filled" : "Order open",
  };
  return { state: preview.status, label: preview.title };
}

function PreviewContent({ preview }: { preview: SubmissionPreview }) {
  const close = useSubmissionPreview(state => state.close);
  const updateOrder = useSubmissionPreview(state => state.updateOrder);
  const queryClient = useQueryClient();
  const { address, chainId } = useConnection();
  const switchChain = useSwitchChain();
  const walletBusy = useSyncExternalStore(subscribeSubmissionLock, isSubmissionBusy, () => false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const closeButton = useRef<HTMLButtonElement>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const descriptionId = useId();
  useEffect(() => {
    // Hiding a focused toast lets Sonner restore focus. Move it into the dialog
    // after that restoration, including when another review is already open.
    let nextFrame = 0;
    const frame = requestAnimationFrame(() => {
      nextFrame = requestAnimationFrame(() => closeButton.current?.focus({ preventScroll: true }));
    });
    return () => { cancelAnimationFrame(frame); cancelAnimationFrame(nextFrame); };
  }, [preview.id]);
  const capturedOrder = preview.order;
  const partner = preview.partner ?? getActiveSpotPartner();
  const account = capturedOrder?.maker ?? preview.account;
  // Follow the captured wallet and partner rather than the current form draft.
  // This shares the existing account-history cache and stops on a terminal status.
  const history = useQuery({
    ...spotOrdersQueryOptions(partner, account, queryClient),
    enabled: Boolean(capturedOrder?.status === OrderStatus.Open && preview.partner && account),
    staleTime: 0,
    refetchOnMount: "always",
    refetchInterval: query => {
      if (capturedOrder?.status !== OrderStatus.Open) return false;
      const current = query.state.data?.find(order => order.chainId === capturedOrder.chainId && order.historyKey === capturedOrder.historyKey);
      return !current || current.status === OrderStatus.Open ? 2_000 : false;
    },
  });
  const refreshedOrder = history.data?.find(order => order.chainId === capturedOrder?.chainId && order.historyKey === capturedOrder.historyKey);
  const order = capturedOrder?.status !== OrderStatus.Open ? capturedOrder : refreshedOrder ?? capturedOrder;
  useEffect(() => {
    if (refreshedOrder && refreshedOrder !== capturedOrder) updateOrder(preview.id, refreshedOrder);
  }, [capturedOrder, preview.id, refreshedOrder, updateOrder]);

  const { cancelOrder, isLoading: cancelling, transactionHash } = useCancelOrder(order, preview.partner);
  useEffect(() => {
    if (!transactionHash) return;
    const store = useSubmissionPreview.getState();
    const entry = store.entries[preview.id];
    if (!entry || entry.transactions?.some(transaction => transaction.hash.toLowerCase() === transactionHash.toLowerCase())) return;
    store.upsert({ ...entry, transactions: [...(entry.transactions ?? []), { label: "Cancellation transaction", hash: transactionHash }] });
  }, [preview.id, transactionHash]);
  const sameWallet = Boolean(order && address && address.toLowerCase() === order.maker.toLowerCase());
  const wrongNetwork = Boolean(order && chainId !== order.chainId);
  const openOrder = order?.status === OrderStatus.Open && Boolean(preview.partner);
  const busy = cancelling || switchChain.isPending;
  const status = getStatus(preview, order, cancelling);
  const StatusIcon = status.state === "success" ? CheckIcon : status.state === "error" ? AlertTriangleIcon : Clock3Icon;
  const transactions = [
    ...(preview.transactions ?? []),
    ...(order?.txHash ? [{ label: "Order transaction", hash: order.txHash }] : []),
    ...(order?.fills.map((fill, index) => ({ label: order.fills.length > 1 ? `Fill ${index + 1}` : "Swap transaction", hash: fill.txHash })) ?? []),
    ...(transactionHash ? [{ label: "Cancellation transaction", hash: transactionHash }] : []),
  ].filter((transaction, index, all) => transaction.hash && all.findIndex(other => other.hash.toLowerCase() === transaction.hash.toLowerCase()) === index);
  const details = preview.details ?? [];
  const outputDecimals = preview.output?.token.decimals;
  const actualOutput = preview.output && order?.status === OrderStatus.Completed && outputDecimals !== undefined
    && Number.isInteger(outputDecimals) && outputDecimals >= 0 && outputDecimals <= 255 && /^\d+$/.test(order.dstAmountFilled)
    ? { ...preview.output, amount: toAmountUI(order.dstAmountFilled, outputDecimals) }
    : undefined;
  const title = preview.kind === "order" ? "Order details" : preview.kind === "wrap" ? "Wrap details" : preview.kind === "unwrap" ? "Unwrap details" : "Swap details";

  const changeNetwork = async () => {
    if (!order || busy || walletBusy) return;
    let release: (() => void) | undefined;
    try {
      release = acquireSubmissionLock();
      await switchChain.mutateAsync({ chainId: order.chainId });
    } catch {
      toast.error("Network switch wasn’t completed. Try again in your wallet.");
    } finally {
      release?.();
    }
  };

  return <DialogContent data-submission-preview-dialog data-submission-preview-id={preview.id} aria-describedby={descriptionId} presentation="center" showCloseButton={false} className={`${styles.preview} max-w-[460px] gap-5 overflow-y-auto p-6`}
    onOpenAutoFocus={event => {
      event.preventDefault();
      trigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      closeButton.current?.focus();
    }}
    onCloseAutoFocus={event => {
      event.preventDefault();
      const target = trigger.current?.isConnected ? trigger.current : document.querySelector<HTMLElement>("main button, main input");
      target?.focus({ preventScroll: true });
    }}>
    <div className="flex items-center justify-between gap-4">
      <DialogTitle className="leading-snug">{title}</DialogTitle>
      <Button ref={closeButton} variant="ghost" size="icon" className="-mr-2 -mt-2 size-9" aria-label="Close submission details" onClick={close}><XIcon aria-hidden="true" className="size-4" /></Button>
    </div>
    <p id={descriptionId} className="sr-only">Captured details and current progress for this {preview.kind === "order" ? "order" : "swap"}.</p>
    {(preview.input || preview.output) && <section aria-label="Trade amounts" className="grid min-w-0 gap-3 rounded-2xl bg-secondary/60 p-4">
      {preview.input && <AssetAmount asset={preview.input} label="From" />}
      {preview.input && preview.output && <ArrowDownIcon aria-hidden="true" className="ml-3 size-4 text-muted-foreground" />}
      {preview.output && <AssetAmount asset={actualOutput ?? preview.output} label={actualOutput ? "Received" : preview.kind === "swap" ? "Estimated receive" : "To"} />}
    </section>}
    <div role="status" aria-live="polite" aria-atomic="true" className="flex items-start gap-3 rounded-xl border border-border/70 px-4 py-3" data-submission-preview-status={status.state}>
      <span aria-hidden="true" className={status.state === "error" ? "mt-0.5 text-destructive" : "mt-0.5 text-primary"}>
        {status.state === "pending" ? <Spinner className="size-4 motion-reduce:animate-none" /> : <StatusIcon className="size-4" />}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium [overflow-wrap:anywhere]">{status.label}</p>
        {preview.message && (!order || order.status === OrderStatus.Open || preview.status !== "pending") && <p className="mt-1 text-xs leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">{preview.message}</p>}
      </div>
    </div>
    <dl className="grid min-w-0 gap-3 text-sm">
      <div className="flex min-w-0 items-start justify-between gap-4"><dt className="text-muted-foreground">Network</dt><dd><NetworkLabel chainId={preview.chainId} /></dd></div>
      {details.map(({ label, value }, index) => <div key={`${label}:${index}`} className="flex min-w-0 items-start justify-between gap-4"><dt className="shrink-0 text-muted-foreground">{label}</dt><dd className="min-w-0 text-right tabular-nums [overflow-wrap:anywhere]">{value}</dd></div>)}
      {order && <>
        <div className="grid min-w-0 gap-1.5"><dt className="text-muted-foreground">Order ID</dt><dd className="font-mono text-xs leading-relaxed [overflow-wrap:anywhere]" translate="no">{order.id}</dd></div>
        <div className="flex items-start justify-between gap-4"><dt className="text-muted-foreground">Trades filled</dt><dd className="tabular-nums">{order.fills.length} of {order.totalTradesAmount}</dd></div>
        {order.deadline > 0 && <div className="flex items-start justify-between gap-4"><dt className="shrink-0 text-muted-foreground">Expires</dt><dd className="text-right"><time dateTime={new Date(order.deadline).toISOString()}>{new Date(order.deadline).toLocaleString()}</time></dd></div>}
      </>}
    </dl>
    {transactions.length > 0 && <section aria-label="Transactions" className="grid min-w-0 gap-3 border-t border-border/70 pt-4">
      {transactions.map(({ label, hash }) => {
        const href = getExplorerUrl(preview.chainId, hash);
        const content = <><span className="flex items-center gap-1.5 text-xs font-medium">{label}{href && <ExternalLinkIcon aria-hidden="true" className="size-3" />}</span><span translate="no" className="mt-1 block font-mono text-xs leading-relaxed [overflow-wrap:anywhere]">{hash}</span></>;
        return href ? <a key={hash} data-submission-preview-transaction href={href} target="_blank" rel="noopener noreferrer" className="min-w-0 rounded-sm text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">{content}</a> : <div key={hash} className="min-w-0">{content}</div>;
      })}
    </section>}
    {openOrder && <div className="grid gap-3">
      {confirmCancel && <p data-submission-preview-cancel-confirmation className="rounded-xl bg-secondary/60 p-3 text-sm leading-relaxed">Cancel this order? Remaining trades will stop once cancellation is confirmed. Trades already filled are unchanged.</p>}
      {!sameWallet && <p role="alert" className="text-xs leading-relaxed text-muted-foreground">Connect the wallet that placed this order to cancel it.</p>}
      {sameWallet && wrongNetwork && <p className="text-xs leading-relaxed text-muted-foreground">Cancellation requires {getNetworkLabel(preview.chainId)}.</p>}
      {sameWallet && walletBusy && !busy && <p className="text-xs leading-relaxed text-muted-foreground">Confirm the pending wallet request before cancelling this order.</p>}
      <div className="grid grid-cols-2 gap-3">
        <Button variant="outline" className="min-h-11" onClick={() => confirmCancel && !busy ? setConfirmCancel(false) : close()}>{confirmCancel && !busy ? "Keep order" : "Close"}</Button>
        <Button data-submission-preview-cancel variant={confirmCancel ? "destructive" : "outline"} className="min-h-11 whitespace-normal" disabled={!sameWallet || walletBusy || busy} isLoading={busy} onClick={() => {
          if (!sameWallet || !openOrder || walletBusy || busy) return;
          if (!confirmCancel) setConfirmCancel(true);
          else if (wrongNetwork) void changeNetwork();
          else cancelOrder(undefined, { onSuccess: () => setConfirmCancel(false) });
        }}>{busy ? cancelling ? "Cancelling…" : "Switching network…" : confirmCancel ? wrongNetwork ? `Switch to ${getNetworkLabel(preview.chainId)}` : "Confirm cancellation" : "Cancel order"}</Button>
      </div>
    </div>}
    {order?.status === OrderStatus.Open && !preview.partner && <p className="text-xs leading-relaxed text-muted-foreground">
      Cancellation is unavailable in this older preview. <a href={getOrderHref(order)} className="rounded-sm text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring">View order details</a>.
    </p>}
    {!openOrder && <Button variant="outline" className="min-h-11 w-full" onClick={close}>Close</Button>}
  </DialogContent>;
}

/** A submission preview never reads or resets the form the user is editing. */
export function SubmissionPreviewDialog() {
  const selectedId = useSubmissionPreview(state => state.selectedId);
  const preview = useSubmissionPreview(state => selectedId ? state.entries[selectedId] : undefined);
  const close = useSubmissionPreview(state => state.close);
  return <Dialog open={Boolean(preview)} onOpenChange={open => { if (!open) close(); }}>
    {preview && <PreviewContent key={preview.id} preview={preview} />}
  </Dialog>;
}
