"use client";

import { useCopyToClipboard } from "@/lib/hooks/use-copy-to-clipboard";

import { CancelOrderDeveloperButton } from "@developer-tools";
import { Button } from "@/components/ui/button";
import { getNetworkLabel } from "@/components/network-label";
import { useIsMobile } from "@/lib/hooks/use-is-mobile";

import { DetailRow } from "@/components/ui/detail-row";
import { EmptyState } from "@/components/ui/empty-state";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { useOrderCurrency } from "./use-order-currency";
import { OrderStatusLabel } from "./order-status-label";
import { TokenSymbol } from "./token-symbol";

import { cn, getExplorerUrl, makeEllipsisAddress } from "@/lib/utils";
import { OrderStatus, type Order } from "@orbs-network/spot-ui";
import { ArrowLeftIcon, ArrowRightIcon, ChevronDownIcon, ChevronRightIcon, ChevronUpIcon, CopyIcon } from "lucide-react";
import { useContext, useId, useState } from "react";
import { Virtuoso } from "react-virtuoso";
import { useConnection, useSwitchChain } from "wagmi";

import { useTranslations } from "@/lib/use-translations";

import { toast } from "sonner";

import { useCancelOrder, useHistoryOrder } from "@/components/advanced-order/use-order-client";

import { DerivedHistoryOrder, DerivedHistoryFill, OpenDetailSection, getOrderTypeLabel, formatDetailDate, formatDuration, formatDisplayNumber, formatTokenValue, formatPriceValue, isZeroValue } from "./format";
import { HistoryPresentation, HistoryTitle } from "./presentation";

function OrderDetailRow({
  label,
  tooltip,
  value,
}: {
  label: string;
  tooltip?: string;
  value: React.ReactNode;
}) {
  const isPage = useContext(HistoryPresentation) !== "modal";
  return (
    <DetailRow
      label={label}
      tooltip={tooltip}
      value={value}
      tone="foreground"
      truncateLabel={!isPage}
      truncateValue={!isPage}
      valueClassName={isPage ? "[overflow-wrap:anywhere]" : undefined}
    />
  );
}

function OrderIdRow({ id }: { id?: string }) {
  const isPage = useContext(HistoryPresentation) !== "modal";
  const { mutate: copyOrderId } = useCopyToClipboard({
    successMessage: "Order ID copied",
    errorMessage: "Failed to copy order ID",
    toastId: "order-id-copied",
  });

  return (
    <div data-detail-row className="flex items-start justify-between gap-4 text-sm">
      <span className="shrink-0 text-foreground">ID</span>
      <div className="flex min-w-0 flex-1 items-start justify-end gap-2">
        {id ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className={cn("block font-medium text-foreground", isPage ? "break-all text-left" : "max-w-[200px] truncate text-right")}>
                {id}
              </span>
            </TooltipTrigger>
            <TooltipContent>{id}</TooltipContent>
          </Tooltip>
        ) : (
          <span className={cn("block max-w-[200px] truncate font-medium text-foreground", isPage ? "text-left" : "text-right")}>
            -
          </span>
        )}
        {id ? (
          <button
            type="button"
            onClick={() => copyOrderId(id)}
            aria-label="Copy order ID"
            className="flex size-6 shrink-0 items-center justify-center rounded-[8px] text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
          >
            <CopyIcon aria-hidden="true" className="size-3.5" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

function DetailSection({
  children,
  collapsibleOnMobile = false,
  onOpenChange,
  open,
  title,
}: {
  children: React.ReactNode;
  collapsibleOnMobile?: boolean;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  title: string;
}) {
  const presentation = useContext(HistoryPresentation);
  const isMobile = useIsMobile();
  const contentId = useId();
  const Icon = open ? ChevronUpIcon : ChevronDownIcon;

  if (presentation !== "modal" && !(presentation === "drawer" && isMobile && collapsibleOnMobile)) {
    return <section data-history-section>
      <h2 className="px-4 py-3 text-sm font-medium">{title}</h2>
      <div className="flex flex-col px-4 pb-3">{children}</div>
    </section>;
  }

  return (
    <div data-history-section className="overflow-hidden rounded-[13px] border border-border/60 bg-secondary/30">
      <h2>
        <button
          type="button"
          onClick={() => onOpenChange(!open)}
          className="flex w-full cursor-pointer items-center justify-between gap-3 px-3 py-3 text-left text-base font-medium text-foreground transition-colors hover:bg-primary/6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/35"
          aria-expanded={open}
          aria-controls={contentId}
        >
          {title}
          <Icon aria-hidden="true" className="size-5 shrink-0" />
        </button>
      </h2>
      <div id={contentId} hidden={!open} className={open ? "flex flex-col gap-2 px-3 pb-3" : undefined}>{open && children}</div>
    </div>
  );
}

function OrderDetailTokenBlock({
  address,
  label,
  chainId,
}: {
  address?: string;
  label: string;
  chainId: number;
}) {
  const { currency, isLoading } = useOrderCurrency(address, chainId);

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="min-w-0 truncate text-[18px] font-semibold leading-none text-foreground">
        <TokenSymbol symbol={currency?.symbol} isLoading={isLoading} />
      </p>
    </div>
  );
}

function OrderPairHeader({ order }: { order: DerivedHistoryOrder }) {
  return (
    <div className="mb-6 flex min-w-0 items-center gap-3">
      <p className="min-w-0 truncate text-sm font-semibold text-foreground">
        {order.inputToken?.symbol}
      </p>
      <ArrowRightIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
      <p className="min-w-0 truncate text-sm font-semibold text-foreground">
        {order.outputToken?.symbol}
      </p>
    </div>
  );
}

function FillDetailCard({ fill, chainId }: { fill: DerivedHistoryFill; chainId: number }) {
  const t = useTranslations();
  const isPage = useContext(HistoryPresentation) !== "modal";
  const explorerUrl = getExplorerUrl(chainId, fill.txHash);

  return (
    <div data-history-section className="flex flex-col gap-1.5 rounded-[13px] border border-border/70 bg-secondary/30 px-4 py-3">
      <OrderDetailRow
        label={t("fillTimestamp")}
        value={formatDetailDate(fill.timestamp)}
      />
      <OrderDetailRow
        label={t("fillAmountOut")}
        value={formatTokenValue(fill.inputAmount.ui, fill.inputToken?.symbol)}
      />
      <OrderDetailRow
        label={t("fillAmountReceived")}
        value={formatTokenValue(fill.outputAmount.ui, fill.outputToken?.symbol)}
      />
      <OrderDetailRow
        label={t("fillTransactionHash")}
        value={
          explorerUrl && fill.txHash ? (
            <a
              href={explorerUrl}
              target="_blank"
              rel="noreferrer"
              className="text-primary transition-colors hover:text-primary/80"
            >
              {isPage ? fill.txHash : makeEllipsisAddress(fill.txHash)}
            </a>
          ) : fill.txHash ? (
            isPage ? fill.txHash : makeEllipsisAddress(fill.txHash)
          ) : (
            "-"
          )
        }
      />
    </div>
  );
}

function DetailNavigationRow({
  disabled,
  meta,
  onClick,
  title,
}: {
  disabled?: boolean;
  meta?: string;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      type="button"
      data-history-section
      onClick={onClick}
      disabled={disabled}
      className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-[13px] border border-border/60 bg-secondary/30 px-3 py-3 text-left text-base font-medium text-foreground transition-colors hover:border-primary/14 hover:bg-primary/6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 disabled:cursor-not-allowed disabled:opacity-55"
    >
      <span className="min-w-0 truncate">{title}</span>
      <span className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
        {meta}
        <ChevronRightIcon aria-hidden="true" className="size-5" />
      </span>
    </button>
  );
}

function HistoryBackButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-[10px] border border-border/70 bg-secondary/35 text-foreground transition-colors hover:border-primary/25 hover:bg-secondary/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
    >
      <ArrowLeftIcon aria-hidden="true" className="size-4" />
    </button>
  );
}

function OrderFillsView({
  onBack,
  order,
}: {
  onBack: () => void;
  order: DerivedHistoryOrder;
}) {
  const t = useTranslations();

  return (
    <div className="flex flex-col px-5 pb-5 pt-5">
      <div className="mb-6 flex items-center gap-4 pr-8">
        <HistoryBackButton label="Back to order details" onClick={onBack} />
        <HistoryTitle className="truncate text-[16px] font-semibold leading-none">
          {getOrderTypeLabel(order.orderType)} order fills
        </HistoryTitle>
      </div>

      <OrderPairHeader order={order} />

      {order.fills.length ? (
        <div className="h-[460px] max-h-[55dvh] overflow-hidden pr-1">
          <Virtuoso
            style={{ height: "100%" }}
            data={order.fills}
            itemContent={(_, fill) => (
              <div className="pb-3">
                <FillDetailCard fill={fill} chainId={order.original.chainId} />
              </div>
            )}
            computeItemKey={(_, fill) =>
              `${fill.txHash}-${fill.timestamp}-${fill.inputAmount.ui}-${fill.outputAmount.ui}`
            }
          />
        </div>
      ) : (
        <EmptyState className="min-h-[140px] rounded-[13px] px-4 text-sm text-muted-foreground">
          {t("noFills")}
        </EmptyState>
      )}
    </div>
  );
}

export function SelectedOrderDetails({
  onBack,
  rawOrder,
}: {
  onBack: () => void;
  rawOrder: Order;
}) {
  const t = useTranslations();
  const presentation = useContext(HistoryPresentation);
  const { currency: srcCurrency } = useOrderCurrency(rawOrder.srcTokenAddress, rawOrder.chainId);
  const { currency: dstCurrency } = useOrderCurrency(rawOrder.dstTokenAddress, rawOrder.chainId);
  const order = useHistoryOrder(rawOrder, srcCurrency, dstCurrency);
  const [view, setView] = useState<"details" | "fills">("details");
  const [fillsOpen, setFillsOpen] = useState(false);
  const [openDetailSection, setOpenDetailSection] =
    useState<OpenDetailSection>("summary");
  const { chainId: connectedChainId } = useConnection();
  const switchChain = useSwitchChain();
  const needsNetworkSwitch = connectedChainId !== rawOrder.chainId;
  const isOpenOrder = order?.original.status === OrderStatus.Open;
  const { cancelOrder, isLoading: isCancelling, isSuccess } =
    useCancelOrder(isOpenOrder ? order?.original : undefined);

  if (!order) return null;

  const progress = Math.max(0, Math.min(100, Math.round(order.progress ?? 0)));

  if (view === "fills") {
    return <OrderFillsView order={order} onBack={() => setView("details")} />;
  }

  return (
    <div data-order-details-content className="px-5 pb-5 pt-5">
      <div data-order-details-scroll>
        {presentation !== "drawer" && <div className="mb-6 flex items-center gap-4 pr-8">
          <HistoryBackButton label="Back to orders" onClick={onBack} />
          <HistoryTitle className="truncate text-[16px] font-semibold leading-none">
            {t("orderDetails")}
          </HistoryTitle>
        </div>}

        <div data-history-token-pair className="mb-6 flex flex-col gap-9">
          <OrderDetailTokenBlock address={rawOrder.srcTokenAddress} chainId={rawOrder.chainId} label="From" />
          <OrderDetailTokenBlock address={rawOrder.dstTokenAddress} chainId={rawOrder.chainId} label="To" />
        </div>

        <div data-order-details-sections className="flex flex-col gap-3">
          <DetailSection
            open={openDetailSection === "summary"}
            onOpenChange={(nextOpen) =>
              setOpenDetailSection(nextOpen ? "summary" : undefined)
            }
            title="Execution summary"
          >
            <OrderDetailRow
              label={t("status")}
              value={<OrderStatusLabel order={order.original} />}
            />
            <OrderDetailRow
              label={t("amountOut")}
              value={formatTokenValue(
                order.inputAmountFilled.ui,
                order.inputToken?.symbol,
              )}
            />
            {order.outputAmountFilled.raw ? (
              <OrderDetailRow
                label={t("amountReceived")}
                value={formatTokenValue(
                  order.outputAmountFilled.ui,
                  order.outputToken?.symbol,
                )}
              />
            ) : null}
            <OrderDetailRow
              label={t("progress")}
              value={`${formatDisplayNumber(progress, 2)}%`}
            />
            {order.executionPrice ? (
              <OrderDetailRow
                label={t(
                  order.original.totalTradesAmount === 1
                    ? "finalExecutionPrice"
                    : "averageExecutionPrice",
                )}
                value={formatPriceValue(
                  order.executionPrice.ui,
                  order.inputToken?.symbol,
                  order.outputToken?.symbol,
                )}
              />
            ) : null}
          </DetailSection>

          <DetailSection
            collapsibleOnMobile
            open={openDetailSection === "info"}
            onOpenChange={(nextOpen) =>
              setOpenDetailSection(nextOpen ? "info" : undefined)
            }
            title={t("orderInfo")}
          >
            <OrderDetailRow
              label={t("orderType")}
              value={getOrderTypeLabel(order.orderType)}
            />
            <OrderIdRow id={order.id} />
            <OrderDetailRow
              label={t("createdAt")}
              value={formatDetailDate(order.createdAt)}
            />
            <OrderDetailRow
              label={t("expirationLabel")}
              tooltip={t("expirationTooltip")}
              value={formatDetailDate(order.deadline)}
            />
            <OrderDetailRow
              label={t("amountOut")}
              value={formatTokenValue(order.inputAmount.ui, order.inputToken?.symbol)}
            />
            {!isZeroValue(order.minOutputAmountPerTrade.ui) ? (
              <OrderDetailRow
                label={t("minReceivedPerTrade")}
                tooltip={t("minDstAmountTooltip")}
                value={formatTokenValue(
                  order.minOutputAmountPerTrade.ui,
                  order.outputToken?.symbol,
                )}
              />
            ) : null}
            {(order.totalTrades || 1) > 1 ? (
              <>
                <OrderDetailRow
                  label={t("numberOfTrades")}
                  tooltip={t("totalTradesTooltip")}
                  value={String(order.totalTrades)}
                />
                <OrderDetailRow
                  label={t("individualTradeSize")}
                  tooltip={t("tradeSizeTooltip")}
                  value={formatTokenValue(
                    order.inputAmountPerTrade.ui,
                    order.inputToken?.symbol,
                  )}
                />
                <OrderDetailRow
                  label={t("tradeIntervalLabel")}
                  tooltip={t("tradeIntervalTooltip")}
                  value={formatDuration(order.tradeInterval)}
                />
              </>
            ) : null}
            {!isZeroValue(order.triggerPrice.ui) ? (
              <OrderDetailRow
                label={t("triggerPrice")}
                tooltip={t("triggerPriceTooltip")}
                value={formatPriceValue(
                  order.triggerPrice.ui,
                  order.inputToken?.symbol,
                  order.outputToken?.symbol,
                )}
              />
            ) : null}
            {order.limitPrice.ui ? (
              <OrderDetailRow
                label={t("limitPrice")}
                tooltip={t("limitPriceTooltip")}
                value={formatPriceValue(
                  order.limitPrice.ui,
                  order.inputToken?.symbol,
                  order.outputToken?.symbol,
                )}
              />
            ) : null}
          </DetailSection>

          {presentation !== "modal" ? (
            <DetailSection
              collapsibleOnMobile
              open={fillsOpen}
              onOpenChange={setFillsOpen}
              title={`${t("orderFills")} (${order.fills.length})`}
            >
              {order.fills.length ? order.fills.map((fill, index) => (
                <div key={`${fill.txHash}-${fill.timestamp}-${index}`} className="[content-visibility:auto] [contain-intrinsic-size:auto_240px]">
                  <FillDetailCard fill={fill} chainId={order.original.chainId} />
                </div>
              )) : <p className="border border-border p-4 text-sm text-muted-foreground">{t("noFills")}</p>}
            </DetailSection>
          ) : (
            <DetailNavigationRow
              title={t("orderFills")}
              meta={String(order.fills.length)}
              onClick={() => setView("fills")}
            />
          )}
        </div>
      </div>

      {isOpenOrder && !isSuccess && (
        <div data-order-details-actions className="mt-4 flex w-full items-center gap-2">
          <Button
            data-submit-button
            type="button"
            onClick={() => {
              if (needsNetworkSwitch) {
                switchChain.mutate({ chainId: rawOrder.chainId }, {
                  onError: () => toast.error("Network switch wasn’t completed. Try again in your wallet."),
                });
              } else cancelOrder();
            }}
            isLoading={isCancelling || switchChain.isPending}
            disabled={isCancelling || switchChain.isPending}
            className="min-h-12 h-auto min-w-0 flex-1 whitespace-normal rounded-[14px] text-base"
          >
            {needsNetworkSwitch ? `Switch to ${getNetworkLabel(rawOrder.chainId)} to cancel` : t("cancelOrder")}
          </Button>
          {!needsNetworkSwitch && <CancelOrderDeveloperButton
            isCancelling={isCancelling}
            onCancel={cancelOrder}
            rawOrder={rawOrder}
          />}
        </div>
      )}
    </div>
  );
}
