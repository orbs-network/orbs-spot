"use client";

import { FetchOrdersDeveloperButton } from "@developer-tools";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";

import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import { StyledSelect } from "@/components/ui/styled-select";
import { HistoryViewTabs } from "./history-view-tabs";

import { IS_ORBS } from "@/lib/partners/client";
import { useWalletConnectModal } from "@/features/wallet-connection/provider";

import { OrderFilter } from "@orbs-network/spot-ui";

import { Virtuoso } from "react-virtuoso";


import { ORDER_FILTER_OPTIONS, getOrderFilterLabel, getNoOrdersTitle, type HistoryFilter } from "./format";
import { HistoryPresentation, HistoryTitle } from "./presentation";
import { OrderListItem } from "./order-list-item";
import { SelectedOrderDetails } from "./details";
import { OrderActivityList } from "./activity-list";
import { OrderDetailsModal } from "./details-modal";
import { useOrderHistory } from "./use-order-history";
import { NetworkFilter } from "./network-filter";
import { OrderSearch } from "./order-search";
const FILTER_OPTIONS = ORDER_FILTER_OPTIONS.map(filter => ({ label: getOrderFilterLabel(filter), value: filter }));
const keepPageOpen = () => {};

export function OrderHistoryPage() {
  return <OrderHistoryView presentation="page" open onOpenChange={keepPageOpen} />;
}

export function OrderHistoryModal(props: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return <OrderHistoryView {...props} presentation="modal" />;
}

function OrderHistoryEmpty({
  hasWallet,
  selectedFilter,
}: {
  hasWallet: boolean;
  selectedFilter: HistoryFilter;
}) {
  const { openConnectModal } = useWalletConnectModal();
  return (
    <EmptyState
      title={
        hasWallet
          ? getNoOrdersTitle(selectedFilter)
          : "Your orders, in one place"
      }
      description={
        hasWallet
          ? selectedFilter === OrderFilter.Open ? "New orders will appear here while they’re active." : "Completed, cancelled and expired orders will appear here."
          : "Connect your wallet to follow active orders and review past trades."
      }
      action={!hasWallet && <Button onClick={() => openConnectModal?.()}>Connect Wallet</Button>}
    />
  );
}

function OrderHistoryView({
  presentation,
  open,
  onOpenChange,
}: {
  presentation: "modal" | "page";
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const {
    address, chainName, orders, networks, drawer, selectedOrder,
    selectedFilter, setSelectedFilter, selectedNetwork, setSelectedNetwork,
    setSelectedOrderId, selectOrder, loading, error, refetch,
    filteredOrders, filterScope, handleOpenChange,
  } = useOrderHistory(presentation, onOpenChange);
  const [search, setSearch] = useState("");

  const filterControl = (
    <StyledSelect
      aria-label="Filter orders"
      value={selectedFilter === "history" ? OrderFilter.All : selectedFilter}
      onValueChange={setSelectedFilter}
      options={FILTER_OPTIONS}
    />
  );

  const content = (
    <HistoryPresentation.Provider value={presentation}>
        {presentation === "modal" && selectedOrder ? (
          <SelectedOrderDetails
            key={selectedOrder.historyKey}
            rawOrder={selectedOrder}
            onBack={() => setSelectedOrderId(undefined)}
          />
        ) : (
          <>
            <DialogHeader data-history-toolbar className="shrink-0 px-5 pb-6 pt-5 text-left">
              <div data-history-heading className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <HistoryTitle className="min-w-0 text-[16px] font-semibold leading-none [overflow-wrap:anywhere]">
                  {presentation === "page" ? "Orders" : `${chainName} order history`}
                </HistoryTitle>
                {presentation === "page" && (
                  <span data-history-refresh role="status" className="inline-flex size-4 shrink-0 items-center justify-center text-muted-foreground">
                    {networks.isFetching && filteredOrders.length > 0 && <>
                      <Spinner aria-hidden="true" />
                      <span className="sr-only">Refreshing orders…</span>
                    </>}
                  </span>
                )}
                <FetchOrdersDeveloperButton
                  isLoading={loading}
                  orders={orders}
                />
              </div>
              {presentation === "page" && <p data-history-scope className="mt-2 text-xs text-muted-foreground">Track active orders and review your completed trades.</p>}
              </div>
              {presentation === "page" && (
                <div data-history-filters className="flex min-w-0 items-center gap-2">
                  {IS_ORBS && <OrderSearch value={search} onChange={setSearch} />}
                  <div data-history-network-filter>
                    <NetworkFilter value={selectedNetwork} onValueChange={setSelectedNetwork} />
                  </div>
                    <HistoryViewTabs
                      value={selectedFilter === OrderFilter.Open ? "open" : "history"}
                      onChange={value => setSelectedFilter(value === "open" ? OrderFilter.Open : value)}
                    />
                </div>
              )}
            </DialogHeader>

            <div data-history-body id={presentation === "page" ? "history-order-results" : undefined} role={presentation === "page" ? "tabpanel" : undefined} aria-labelledby={presentation === "page" ? `history-view-${selectedFilter === OrderFilter.Open ? "open" : "history"}` : undefined} className="flex min-h-0 flex-col gap-4 overflow-y-auto px-5 pb-5">
              {error && orders.length > 0 && (
                <div role="alert" className="flex flex-wrap items-center gap-2 border border-border p-3 text-xs text-muted-foreground">
                  <p className="min-w-0 flex-1">Could not refresh order history. Showing the last available orders.</p>
                  <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={networks.isFetching}>Retry history</Button>
                </div>
              )}
              {presentation === "modal" && <div className="flex flex-wrap items-center justify-between gap-3">
                {IS_ORBS && <OrderSearch value={search} onChange={setSearch} />}
                <div className="w-full sm:w-[144px]">
                  {filterControl}
                </div>
                {IS_ORBS && !loading && !error && filteredOrders.length > 0 && (
                  <p role="status" className="text-xs text-muted-foreground">{filteredOrders.length} {filteredOrders.length === 1 ? "order" : "orders"}</p>
                )}
              </div>}

              {IS_ORBS ? (
                <OrderActivityList
                  scope={filterScope}
                  contained={presentation === "modal"}
                  view={selectedFilter === OrderFilter.Open ? "open" : "history"}
                  network={selectedNetwork}
                  orders={filteredOrders}
                  allOrders={orders}
                  search={search}
                  onClearSearch={() => setSearch("")}
                  onSelect={selectOrder}
                >
                  {error ? (
                    <div role="alert" className="flex min-h-60 flex-col items-center justify-center gap-3 p-5 text-sm">
                      <p>Could not load order history.</p>
                      <Button variant="outline" onClick={() => void refetch()}>Retry history</Button>
                    </div>
                  ) : loading ? (
                    <div role="status" className="flex min-h-60 items-center justify-center gap-3 text-sm text-muted-foreground"><Spinner className="size-5" />Loading orders…</div>
                  ) : <OrderHistoryEmpty hasWallet={Boolean(address)} selectedFilter={selectedFilter} />}
                </OrderActivityList>
              ) : error ? (
                <div role="alert" className="flex flex-col items-center gap-3 py-8 text-sm">
                  <p>Could not load order history: {error.message}</p>
                  <button data-hover="text" type="button" className="text-primary underline" onClick={() => void refetch()}>Retry history</button>
                </div>
              ) : loading && !filteredOrders.length ? (
                <div className="flex min-h-[240px] items-center justify-center">
                  <Spinner className="size-10" />
                </div>
              ) : filteredOrders.length ? (
                <div className="h-[560px] max-h-[65dvh] overflow-hidden">
                  <Virtuoso
                    style={{ height: "100%" }}
                    data={filteredOrders}
                    computeItemKey={(_, order) => order.historyKey}
                    itemContent={(_, order) => (
                      <OrderListItem
                        order={order}
                        onSelect={selectOrder}
                      />
                    )}
                  />
                </div>
              ) : (
                <OrderHistoryEmpty
                  hasWallet={Boolean(address)}
                  selectedFilter={selectedFilter}
                />
              )}
            </div>
          </>
        )}
    </HistoryPresentation.Provider>
  );

  if (presentation === "page") {
    return (
      <>
        <section data-order-history data-history-page data-history-view="table">
          {content}
        </section>
        <OrderDetailsModal
          orderId={drawer.orderId}
          order={selectedOrder}
          chainId={drawer.chainId}
          hasWallet={Boolean(address)}
          loading={loading}
          error={error}
          onClose={drawer.close}
          onCloseAutoFocus={drawer.restoreFocus}
          onRetry={() => void networks.refetch()}
        />
      </>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        data-order-history
        data-history-view={IS_ORBS && !selectedOrder ? "table" : "details"}
        aria-describedby={undefined}
        presentation="center"
        className="!flex h-auto w-[calc(100vw-1.5rem)] max-w-[500px] flex-col gap-0 overflow-hidden rounded-[22px] border-border/80 p-0"
      >
        {content}
      </DialogContent>
    </Dialog>
  );
}
