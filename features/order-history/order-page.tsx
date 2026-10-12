"use client";

import Link from "next/link";
import { ArrowLeftIcon, RefreshCwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { NetworkLabel } from "@/components/network-label";
import { useWalletConnectModal } from "@/features/wallet-connection/provider";
import { OrderPageDetails } from "./order-page-details";
import { useOrderPage } from "./use-order-page";
import { getOrderTypeLabel } from "./format";
import { OrderStatusLabel } from "./order-status-label";
import styles from "./order-page.module.css";

export function OrderDetailPage({ chainId, orderId, account }: {
  chainId: number;
  orderId: string;
  account?: string;
}) {
  const query = useOrderPage(chainId, orderId, account);
  const { openConnectModal } = useWalletConnectModal();
  const { order } = query;

  return (
    <article data-order-page className={styles.page}>
      <Link href="/orders" className="inline-flex min-h-11 w-fit items-center gap-2 rounded-lg text-sm text-muted-foreground focus-visible:outline-2 focus-visible:outline-primary">
        <ArrowLeftIcon aria-hidden="true" className="size-4" />Back to orders
      </Link>
      <div className={styles.card}>
        <header className={styles.header}>
          <div className="min-w-0">
            <div className="mb-2 text-xs text-muted-foreground"><NetworkLabel chainId={chainId} /></div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight">{order ? `${getOrderTypeLabel(order.type)} order` : "Order details"}</h1>
              {order && <span className={styles.status} data-status={order.status}><OrderStatusLabel order={order} /></span>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="size-11" aria-label="Refresh order" disabled={!query.account || query.isFetching} onClick={() => void query.refetch()}>
              <RefreshCwIcon aria-hidden="true" className={query.isFetching ? "size-4 animate-spin motion-reduce:animate-none" : "size-4"} />
            </Button>
          </div>
        </header>
        {query.error && order && <div role="alert" className="mx-5 rounded-xl bg-destructive/10 p-3 text-sm">Could not refresh this order. Showing the last available details.<button data-hover="text" className="ml-2 underline" onClick={() => void query.refetch()}>Retry</button></div>}
        {order ? (
          <OrderPageDetails key={order.historyKey} order={order} />
        ) : (
          <div className={styles.state}>
            {!query.account ? <><h2 className="text-lg font-medium">Connect wallet to view this order</h2><p className="text-sm text-muted-foreground">Connect the wallet that placed the order.</p><Button onClick={() => openConnectModal?.()}>Connect wallet</Button></>
              : query.isLoading || query.isFetching && query.isPlaceholderData ? <div role="status" className="flex items-center gap-3 text-sm text-muted-foreground"><Spinner className="size-5" />Loading order details…</div>
              : query.error ? <><h2 role="alert" className="text-lg font-medium">Could not load this order</h2><p className="text-sm text-muted-foreground">Try loading the order again.</p><Button variant="outline" onClick={() => void query.refetch()}>Retry</Button></>
              : <><h2 className="text-lg font-medium">Order not found</h2><p className="max-w-md text-sm text-muted-foreground">Check the order link. If the order was just placed, it may take a moment to appear.</p><Button variant="outline" disabled={query.isFetching} onClick={() => void query.refetch()}>Check again</Button></>}
          </div>
        )}
      </div>
    </article>
  );
}
