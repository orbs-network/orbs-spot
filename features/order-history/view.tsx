"use client";

import { FetchOrdersDeveloperButton } from "@developer-tools";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";

import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import { StyledSelect } from "@/components/ui/styled-select";

import { IS_ORBS } from "@/lib/partners/client";

import { getChainName } from "@/lib/utils";
import { OrderFilter } from "@orbs-network/spot-ui";

import { Virtuoso } from "react-virtuoso";


import { ORDER_FILTER_OPTIONS, getOrderFilterLabel, getNoOrdersTitle } from "./format";
import { HistoryPresentation, HistoryTitle } from "./presentation";
import { OrderListItem } from "./order-list-item";
import { SelectedOrderDetails } from "./details";
import { OrderHistoryTable } from "./table";
import { OrderDetailsDrawer } from "./details-drawer";
import { useOrderHistory } from "./use-order-history";
import { NetworkFilter } from "./network-filter";
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
  selectedFilter: OrderFilter;
}) {
  return (
    <EmptyState
      title={
        hasWallet
          ? getNoOrdersTitle(selectedFilter)
          : "Connect wallet to view orders"
      }
      description={
        hasWallet
          ? "Your order history will appear here after you create an order."
          : "Connect your wallet to view its order history."
      }
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
    setSelectedOrderId, selectOrder, failedNetworks, loading, error, refetch,
    selectedNetworkError, filteredOrders, paginationScope, pageIndex,
    pageSize, onPageChange, onPageSizeChange, handleOpenChange,
  } = useOrderHistory(presentation, onOpenChange);

  const filterControl = (
    <StyledSelect
      aria-label="Filter orders"
      value={selectedFilter}
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
              <div className="flex min-w-0 items-center gap-2">
                <HistoryTitle className="min-w-0 text-[16px] font-semibold leading-none [overflow-wrap:anywhere]">
                  {presentation === "page" ? "Order history" : `${chainName} order history`}
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
              {presentation === "page" && (
                <div data-history-filters className="flex min-w-0 items-center gap-2">
                  <div data-history-network-filter>
                    <NetworkFilter value={selectedNetwork} onValueChange={setSelectedNetwork} />
                  </div>
                  <div data-history-filter>{filterControl}</div>
                </div>
              )}
            </DialogHeader>

            <div data-history-body className="flex min-h-0 flex-col gap-4 overflow-y-auto px-5 pb-5">
              {presentation === "page" && failedNetworks.length > 0 && (
                <div role="alert" className="flex flex-wrap items-center gap-2 border border-border p-3 text-xs text-muted-foreground">
                  <p className="min-w-0 flex-1">History unavailable on {failedNetworks.map(failure => getChainName(failure.chainId)).join(", ")}. Available orders are shown; results may be incomplete.</p>
                  <Button variant="outline" size="sm" onClick={() => void networks.refetch()} disabled={networks.isFetching}>Retry networks</Button>
                </div>
              )}
              {presentation === "modal" && <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="w-full sm:w-[144px]">
                  {filterControl}
                </div>
                {IS_ORBS && !loading && !error && filteredOrders.length > 0 && (
                  <p role="status" className="text-xs text-muted-foreground">{filteredOrders.length} {filteredOrders.length === 1 ? "order" : "orders"}</p>
                )}
              </div>}

              {IS_ORBS ? (
                <OrderHistoryTable
                  filterScope={paginationScope}
                  orders={filteredOrders}
                  onSelect={selectOrder}
                  pageIndex={pageIndex}
                  pageSize={pageSize}
                  onPageChange={onPageChange}
                  onPageSizeChange={onPageSizeChange}
                >
                  {error ? (
                    <div role="alert" className="flex min-h-60 flex-col items-center justify-center gap-3 p-5 text-sm">
                      <p>Could not load order history.</p>
                      <Button variant="outline" onClick={() => void refetch()}>Retry history</Button>
                    </div>
                  ) : loading ? (
                    <div role="status" className="flex min-h-60 items-center justify-center gap-3 text-sm text-muted-foreground"><Spinner className="size-5" />Loading orders…</div>
                  ) : <OrderHistoryEmpty hasWallet={Boolean(address)} selectedFilter={selectedFilter} />}
                </OrderHistoryTable>
              ) : error ? (
                <div role="alert" className="flex flex-col items-center gap-3 py-8 text-sm">
                  <p>Could not load order history: {error.message}</p>
                  <button type="button" className="text-primary underline" onClick={() => void refetch()}>Retry history</button>
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
        <OrderDetailsDrawer
          orderId={drawer.orderId}
          order={selectedOrder}
          chainId={drawer.chainId}
          hasWallet={Boolean(address)}
          loading={networks.isLoading}
          error={selectedNetworkError ?? networks.error}
          onClose={drawer.close}
          onCloseAutoFocus={drawer.restoreFocus}
          onRetry={() => void networks.refetch()}
        />
      </>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange} responsive={false}>
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
