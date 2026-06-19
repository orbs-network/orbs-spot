"use client";

import { CurrencyLogo } from "@/components/ui/currency-logo";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useCurrency } from "@/lib/hooks/use-currencies";
import {
  cn,
  formatDecimals,
  getExplorerUrl,
  makeEllipsisAddress,
} from "@/lib/utils";
import {
  OrderFilter,
  OrderStatus,
  OrderType,
  TimeUnit,
  useCancelOrder,
  useDerivedHistoryOrder,
  useSpot,
  type Order,
} from "@orbs-network/spot-react";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  CopyIcon,
  InfoIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Virtuoso } from "react-virtuoso";
import { useConnection } from "wagmi";
import { useTranslations } from "@/lib/use-translations";
import BN from "bignumber.js";
import { toast } from "sonner";

const ORDER_HISTORY_CLOSE_RESET_DELAY = 180;
const ORDER_LIST_ITEM_ESTIMATED_HEIGHT = 92;
const ORDER_LIST_MAX_HEIGHT = 560;
const ORDER_LIST_MIN_HEIGHT = 118;
const FILL_LIST_ITEM_ESTIMATED_HEIGHT = 132;
const FILL_LIST_MAX_HEIGHT = 520;
const FILL_LIST_MIN_HEIGHT = 140;

const ORDER_FILTER_OPTIONS = [
  OrderFilter.All,
  OrderFilter.Open,
  OrderFilter.Completed,
  OrderFilter.Cancelled,
  OrderFilter.Expired,
] as const;

type DerivedHistoryOrder = NonNullable<
  ReturnType<typeof useDerivedHistoryOrder>
>;
type DerivedHistoryFill = DerivedHistoryOrder["fills"][number];
type OpenDetailSection = "summary" | "info" | undefined;

function getVirtualListHeight(
  itemCount: number,
  estimatedItemHeight: number,
  maxHeight: number,
  minHeight: number,
) {
  return Math.min(
    maxHeight,
    Math.max(minHeight, itemCount * estimatedItemHeight),
  );
}

const STATUS_CLASS_NAMES: Record<OrderStatus, string> = {
  [OrderStatus.Open]: "text-primary",
  [OrderStatus.Completed]: "text-emerald-400",
  [OrderStatus.Cancelled]: "text-red-400",
  [OrderStatus.Expired]: "text-red-400",
};

const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  [OrderType.LIMIT]: "Limit",
  [OrderType.TWAP_LIMIT]: "TWAP Limit",
  [OrderType.TWAP_MARKET]: "TWAP Market",
  [OrderType.TAKE_PROFIT_LIMIT]: "Take Profit Limit",
  [OrderType.TAKE_PROFIT_MARKET]: "Take Profit Market",
  [OrderType.STOP_LOSS_LIMIT]: "Stop Loss Limit",
  [OrderType.STOP_LOSS_MARKET]: "Stop Loss Market",
};

function getOrderFilterLabel(filter: OrderFilter) {
  switch (filter) {
    case OrderFilter.All:
      return "All";
    case OrderFilter.Open:
      return "Open";
    case OrderFilter.Completed:
      return "Completed";
    case OrderFilter.Cancelled:
      return "Cancelled";
    case OrderFilter.Expired:
      return "Expired";
    default:
      return filter;
  }
}

function getOrderTypeLabel(orderType?: OrderType) {
  if (!orderType) return "Order";
  return ORDER_TYPE_LABELS[orderType] ?? "Order";
}

function normalizeTimestamp(timestamp?: number) {
  if (!timestamp) return undefined;
  return timestamp < 1_000_000_000_000 ? timestamp * 1000 : timestamp;
}

function formatOrderDate(timestamp?: number) {
  const normalizedTimestamp = normalizeTimestamp(timestamp);
  if (!normalizedTimestamp) return "";

  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(normalizedTimestamp));
}

function formatDetailDate(timestamp?: number) {
  const normalizedTimestamp = normalizeTimestamp(timestamp);
  if (!normalizedTimestamp) return "-";

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(normalizedTimestamp));
}

function formatDurationUnit(value: number, unit: string) {
  return `${value} ${unit}${value === 1 ? "" : "s"}`;
}

function formatDuration(ms?: number) {
  if (!ms) return "-";
  const minutes = Math.round(ms / TimeUnit.Minutes);
  if (minutes < 60) return formatDurationUnit(minutes, "Minute");
  const hours = Math.round(ms / TimeUnit.Hours);
  if (hours < 48) return formatDurationUnit(hours, "Hour");
  const days = Math.round(ms / TimeUnit.Days);
  return formatDurationUnit(days, "Day");
}

function filterAndSortOrders(orders: Order[], filter: OrderFilter) {
  const filtered =
    filter === OrderFilter.All
      ? orders
      : orders.filter(
          (order) => order.status === (filter as unknown as OrderStatus),
        );

  return [...filtered].sort((a, b) => b.createdAt - a.createdAt);
}

function getOrderStatusLabel(status: OrderStatus) {
  return getOrderFilterLabel(status as unknown as OrderFilter).toUpperCase();
}

function getOrderStatusTitle(status: OrderStatus) {
  return getOrderFilterLabel(status as unknown as OrderFilter);
}

function formatDisplayNumber(value?: string | number, decimalScale = 4) {
  return formatDecimals(value?.toString() || "0", decimalScale) || "0";
}

function formatTokenValue(
  amount?: string,
  symbol?: string,
  decimalScale = 4,
) {
  return `${formatDisplayNumber(amount, decimalScale)} ${symbol ?? ""}`.trim();
}

function formatPriceValue(
  price?: string,
  srcSymbol?: string,
  dstSymbol?: string,
) {
  if (!price) return "-";
  return `1 ${srcSymbol ?? ""} = ${formatDisplayNumber(price, 3)} ${
    dstSymbol ?? ""
  }`.trim();
}

function isZeroValue(value?: string | number) {
  if (!value) return true;
  return BN(value).isZero();
}

function OrderToken({ address }: { address?: string }) {
  const currency = useCurrency(address);

  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <CurrencyLogo currency={currency} className="size-5" />
      <p className="truncate text-[13px] font-semibold text-foreground">
        {currency?.symbol ?? makeEllipsisAddress(address)}
      </p>
    </div>
  );
}

function OrderProgress({
  status,
  value,
}: {
  status: OrderStatus;
  value?: number;
}) {
  const progress = Math.max(0, Math.min(100, Math.round(value ?? 0)));
  const isComplete = status === OrderStatus.Completed;

  return (
    <div className="flex items-center gap-3">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border">
        <div
          className={cn(
            "h-full rounded-full transition-[width]",
            isComplete ? "bg-primary" : "bg-border",
          )}
          style={{ width: `${progress}%` }}
        />
      </div>
      <span className="w-10 text-right text-sm font-medium text-muted-foreground">
        {progress}%
      </span>
    </div>
  );
}

function OrderListItem({
  onSelect,
  order,
}: {
  onSelect: (order: Order) => void;
  order: Order;
}) {
  const orderTitle = getOrderTypeLabel(order.type);
  const orderDate = formatOrderDate(order.createdAt);

  return (
    <button
      type="button"
      onClick={() => onSelect(order)}
      className="mb-1.5 flex w-full cursor-pointer flex-col gap-2 rounded-[13px] border border-border/50 bg-secondary/30 px-3 py-2 text-left transition-colors hover:border-primary/14 hover:bg-primary/6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 truncate text-[13px] font-medium text-foreground">
          {orderTitle}
          {orderDate && <span className="font-normal"> ({orderDate})</span>}
        </p>
        <span
          className={cn(
            "shrink-0 text-[10px] font-semibold leading-none",
            STATUS_CLASS_NAMES[order.status],
          )}
        >
          {getOrderStatusLabel(order.status)}
        </span>
      </div>
      <OrderProgress status={order.status} value={order.progress} />
      <div className="flex min-w-0 items-center gap-2">
        <OrderToken address={order.srcTokenAddress} />
        <ArrowRightIcon className="size-4 shrink-0 text-foreground" />
        <OrderToken address={order.dstTokenAddress} />
      </div>
    </button>
  );
}

function DetailRow({
  label,
  tooltip,
  value,
}: {
  label: string;
  tooltip?: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="flex min-w-0 items-center gap-1.5 text-foreground">
        <span className="truncate">{label}</span>
        {tooltip ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={`${label} info`}
                className="flex size-4 shrink-0 cursor-pointer items-center justify-center text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
              >
                <InfoIcon className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>{tooltip}</TooltipContent>
          </Tooltip>
        ) : null}
      </span>
      <span className="min-w-0 truncate text-right font-medium text-foreground">
        {value}
      </span>
    </div>
  );
}

function OrderIdRow({ id }: { id?: string }) {
  const copyOrderId = useCallback(async () => {
    if (!id) return;

    try {
      await navigator.clipboard.writeText(id);
      toast.success("Order ID copied", { id: "order-id-copied" });
    } catch {
      toast.error("Failed to copy order ID", { id: "order-id-copied" });
    }
  }, [id]);

  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="shrink-0 text-foreground">ID</span>
      <div className="flex min-w-0 flex-1 items-start justify-end gap-2">
        {id ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="block max-w-[200px] truncate text-right font-medium text-foreground">
                {id}
              </span>
            </TooltipTrigger>
            <TooltipContent>{id}</TooltipContent>
          </Tooltip>
        ) : (
          <span className="block max-w-[200px] truncate text-right font-medium text-foreground">
            -
          </span>
        )}
        {id ? (
          <button
            type="button"
            onClick={() => void copyOrderId()}
            aria-label="Copy order ID"
            className="flex size-6 shrink-0 items-center justify-center rounded-[8px] text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
          >
            <CopyIcon className="size-3.5" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

function DetailSection({
  children,
  onOpenChange,
  open,
  title,
}: {
  children: React.ReactNode;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  title: string;
}) {
  const Icon = open ? ChevronUpIcon : ChevronDownIcon;

  return (
    <div className="overflow-hidden rounded-[13px] border border-border/60 bg-secondary/30">
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        className="flex w-full cursor-pointer items-center justify-between gap-3 px-3 py-3 text-left text-base font-medium text-foreground transition-colors hover:bg-primary/6"
      >
        {title}
        <Icon className="size-5 shrink-0" />
      </button>
      {open && <div className="flex flex-col gap-2 px-3 pb-3">{children}</div>}
    </div>
  );
}

function OrderDetailTokenBlock({
  address,
  label,
}: {
  address?: string;
  label: string;
}) {
  const currency = useCurrency(address);

  return (
    <div className="flex items-start justify-between gap-6">
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-2 truncate text-[18px] font-semibold leading-none text-foreground">
          {currency?.symbol ?? makeEllipsisAddress(address)}
        </p>
      </div>
      <CurrencyLogo currency={currency} className="mt-1 size-10 shrink-0" />
    </div>
  );
}

function OrderPairHeader({ order }: { order: DerivedHistoryOrder }) {
  return (
    <div className="mb-6 flex min-w-0 items-center gap-3">
      <CurrencyLogo
        logoUrl={order.srcToken?.logoUrl}
        symbol={order.srcToken?.symbol}
        className="size-8 shrink-0"
      />
      <p className="min-w-0 truncate text-sm font-semibold text-foreground">
        {order.srcToken?.symbol}
      </p>
      <ArrowRightIcon className="size-4 shrink-0 text-muted-foreground" />
      <CurrencyLogo
        logoUrl={order.dstToken?.logoUrl}
        symbol={order.dstToken?.symbol}
        className="size-8 shrink-0"
      />
      <p className="min-w-0 truncate text-sm font-semibold text-foreground">
        {order.dstToken?.symbol}
      </p>
    </div>
  );
}

function FillDetailCard({ fill }: { fill: DerivedHistoryFill }) {
  const t = useTranslations();
  const { chainId } = useConnection();
  const explorerUrl = getExplorerUrl(chainId, fill.txHash);

  return (
    <div className="flex flex-col gap-1.5 rounded-[13px] border border-border/70 bg-secondary/30 px-4 py-3">
      <DetailRow
        label={t("fillTimestamp")}
        value={formatDetailDate(fill.timestamp)}
      />
      <DetailRow
        label={t("fillAmountOut")}
        value={formatTokenValue(fill.srcAmount, fill.srcToken?.symbol)}
      />
      <DetailRow
        label={t("fillAmountReceived")}
        value={formatTokenValue(fill.dstAmount, fill.dstToken?.symbol)}
      />
      <DetailRow
        label={t("fillTransactionHash")}
        value={
          explorerUrl && fill.txHash ? (
            <a
              href={explorerUrl}
              target="_blank"
              rel="noreferrer"
              className="text-primary transition-colors hover:text-primary/80"
            >
              {makeEllipsisAddress(fill.txHash)}
            </a>
          ) : fill.txHash ? (
            makeEllipsisAddress(fill.txHash)
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
      onClick={onClick}
      disabled={disabled}
      className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-[13px] border border-border/60 bg-secondary/30 px-3 py-3 text-left text-base font-medium text-foreground transition-colors hover:border-primary/14 hover:bg-primary/6 disabled:cursor-not-allowed disabled:opacity-55"
    >
      <span className="min-w-0 truncate">{title}</span>
      <span className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
        {meta}
        <ChevronRightIcon className="size-5" />
      </span>
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
  const fillsHeight = getVirtualListHeight(
    order.fills.length,
    FILL_LIST_ITEM_ESTIMATED_HEIGHT,
    FILL_LIST_MAX_HEIGHT,
    FILL_LIST_MIN_HEIGHT,
  );

  return (
    <div className="flex flex-col px-5 pb-5 pt-5">
      <div className="mb-6 flex items-center gap-4 pr-8">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to order details"
          className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-[10px] border border-border/70 bg-secondary/35 text-foreground transition-colors hover:border-primary/25 hover:bg-secondary/55"
        >
          <ArrowLeftIcon className="size-4" />
        </button>
        <DialogTitle className="truncate text-[16px] font-semibold leading-none">
          {getOrderTypeLabel(order.orderType)} order fills
        </DialogTitle>
      </div>

      <OrderPairHeader order={order} />

      {order.fills.length ? (
        <div
          className="overflow-hidden pr-1"
          style={{ height: fillsHeight, maxHeight: "66dvh" }}
        >
          <Virtuoso
            style={{ height: "100%" }}
            data={order.fills}
            itemContent={(_, fill) => (
              <div className="pb-3">
                <FillDetailCard fill={fill} />
              </div>
            )}
            computeItemKey={(_, fill) =>
              `${fill.txHash}-${fill.timestamp}-${fill.srcAmount}-${fill.dstAmount}`
            }
          />
        </div>
      ) : (
        <div className="flex min-h-[140px] items-center justify-center rounded-[13px] border border-dashed border-border/80 bg-secondary/20 px-4 text-center text-sm text-muted-foreground">
          {t("noFills")}
        </div>
      )}
    </div>
  );
}

function SelectedOrderDetails({
  onBack,
  onCancelSuccess,
  rawOrder,
}: {
  onBack: () => void;
  onCancelSuccess: () => void;
  rawOrder: Order;
}) {
  const t = useTranslations();
  const srcCurrency = useCurrency(rawOrder.srcTokenAddress);
  const dstCurrency = useCurrency(rawOrder.dstTokenAddress);
  const order = useDerivedHistoryOrder(rawOrder, srcCurrency, dstCurrency);
  const [view, setView] = useState<"details" | "fills">("details");
  const [openDetailSection, setOpenDetailSection] =
    useState<OpenDetailSection>("summary");
  const isOpenOrder = order?.original.status === OrderStatus.Open;
  const { cancelOrder, isLoading: isCancelling, isSuccess } =
    useCancelOrder(isOpenOrder ? order?.original : undefined);

  useEffect(() => {
    if (isSuccess) {
      onCancelSuccess();
    }
  }, [isSuccess, onCancelSuccess]);

  if (!order) return null;

  const progress = Math.max(0, Math.min(100, Math.round(order.progress ?? 0)));

  if (view === "fills") {
    return <OrderFillsView order={order} onBack={() => setView("details")} />;
  }

  return (
    <div className="px-5 pb-5 pt-5">
      <div className="mb-6 flex items-center gap-4 pr-8">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to orders"
          className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-[10px] border border-border/70 bg-secondary/35 text-foreground transition-colors hover:border-primary/25 hover:bg-secondary/55"
        >
          <ArrowLeftIcon className="size-4" />
        </button>
        <DialogTitle className="truncate text-[16px] font-semibold leading-none">
          {t("orderDetails")}
        </DialogTitle>
      </div>

      <div className="mb-6 flex flex-col gap-9">
        <OrderDetailTokenBlock address={rawOrder.srcTokenAddress} label="From" />
        <OrderDetailTokenBlock address={rawOrder.dstTokenAddress} label="To" />
      </div>

      <div className="flex flex-col gap-3">
        <DetailSection
          open={openDetailSection === "summary"}
          onOpenChange={(nextOpen) =>
            setOpenDetailSection(nextOpen ? "summary" : undefined)
          }
          title="Execution summary"
        >
          <DetailRow
            label={t("status")}
            value={getOrderStatusTitle(order.original.status)}
          />
          <DetailRow
            label={t("amountOut")}
            value={formatTokenValue(
              order.amountInFilledUI,
              order.srcToken?.symbol,
            )}
          />
          {order.amountOutFilled ? (
            <DetailRow
              label={t("amountReceived")}
              value={formatTokenValue(
                order.amountOutFilledUI,
                order.dstToken?.symbol,
              )}
            />
          ) : null}
          <DetailRow
            label={t("progress")}
            value={`${formatDisplayNumber(progress, 2)}%`}
          />
          {order.executionPrice ? (
            <DetailRow
              label={t(
                order.original.totalTradesAmount === 1
                  ? "finalExecutionPrice"
                  : "averageExecutionPrice",
              )}
              value={formatPriceValue(
                order.executionPriceUI,
                order.srcToken?.symbol,
                order.dstToken?.symbol,
              )}
            />
          ) : null}
        </DetailSection>

        <DetailSection
          open={openDetailSection === "info"}
          onOpenChange={(nextOpen) =>
            setOpenDetailSection(nextOpen ? "info" : undefined)
          }
          title={t("orderInfo")}
        >
          <DetailRow
            label={t("orderType")}
            value={getOrderTypeLabel(order.orderType)}
          />
          <OrderIdRow id={order.id} />
          <DetailRow
            label={t("createdAt")}
            value={formatDetailDate(order.createdAt)}
          />
          <DetailRow
            label={t("expirationLabel")}
            tooltip={t("expirationTooltip")}
            value={formatDetailDate(order.deadline)}
          />
          <DetailRow
            label={t("amountOut")}
            value={formatTokenValue(order.srcAmountUI, order.srcToken?.symbol)}
          />
          {!isZeroValue(order.minDestAmountPerTradeUI) ? (
            <DetailRow
              label={t("minReceivedPerTrade")}
              tooltip={t("minDstAmountTooltip")}
              value={formatTokenValue(
                order.minDestAmountPerTradeUI,
                order.dstToken?.symbol,
              )}
            />
          ) : null}
          {(order.totalTrades || 1) > 1 ? (
            <>
              <DetailRow
                label={t("numberOfTrades")}
                tooltip={t("totalTradesTooltip")}
                value={String(order.totalTrades)}
              />
              <DetailRow
                label={t("individualTradeSize")}
                tooltip={t("tradeSizeTooltip")}
                value={formatTokenValue(
                  order.sizePerTradeUI,
                  order.srcToken?.symbol,
                )}
              />
              <DetailRow
                label={t("tradeIntervalLabel")}
                tooltip={t("tradeIntervalTooltip")}
                value={formatDuration(order.tradeInterval)}
              />
            </>
          ) : null}
          {!isZeroValue(order.triggerPriceUI) ? (
            <DetailRow
              label={t("triggerPrice")}
              tooltip={t("triggerPriceTooltip")}
              value={formatPriceValue(
                order.triggerPriceUI,
                order.srcToken?.symbol,
                order.dstToken?.symbol,
              )}
            />
          ) : null}
          {order.limitPriceUI ? (
            <DetailRow
              label={t("limitPrice")}
              tooltip={t("limitPriceTooltip")}
              value={formatPriceValue(
                order.limitPriceUI,
                order.srcToken?.symbol,
                order.dstToken?.symbol,
              )}
            />
          ) : null}
        </DetailSection>

        <DetailNavigationRow
          title={t("orderFills")}
          meta={String(order.fills.length)}
          onClick={() => setView("fills")}
        />

        {isOpenOrder && (
          <Button
            type="button"
            onClick={() => void cancelOrder()}
            isLoading={isCancelling}
            disabled={isCancelling}
            className="mt-1 h-12 w-full rounded-[6px] border border-red-400/30 bg-red-500/15 text-base font-semibold text-red-200 shadow-none transition-colors hover:bg-red-500/20"
          >
            {t("cancelOrder")}
          </Button>
        )}
      </div>
    </div>
  );
}

function OrderHistoryEmpty({
  hasWallet,
  selectedFilter,
}: {
  hasWallet: boolean;
  selectedFilter: OrderFilter;
}) {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center rounded-[18px] border border-dashed border-border/80 bg-secondary/20 px-6 text-center">
      <p className="text-base font-semibold text-foreground">
        {hasWallet
          ? `No ${getOrderFilterLabel(selectedFilter).toLowerCase()} orders`
          : "Connect wallet to view orders"}
      </p>
      <p className="mt-2 max-w-[256px] text-sm text-muted-foreground">
        {hasWallet
          ? "Your order history will appear here after you create an order."
          : "Order history is loaded from the connected wallet on the selected network."}
      </p>
    </div>
  );
}

export function OrderHistoryModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { address } = useConnection();
  const {
    orders,
    isLoading,
    isRefetching,
  } = useSpot().orderHistoryPanel;
  const [selectedFilter, setSelectedFilter] = useState<OrderFilter>(
    OrderFilter.All,
  );
  const [selectedOrder, setSelectedOrder] = useState<Order | undefined>();
  const clearSelectedOrderTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearSelectedOrderTimer = useCallback(() => {
    if (!clearSelectedOrderTimerRef.current) return;
    clearTimeout(clearSelectedOrderTimerRef.current);
    clearSelectedOrderTimerRef.current = null;
  }, []);

  useEffect(() => clearSelectedOrderTimer, [clearSelectedOrderTimer]);

  const filteredOrders = useMemo(
    () => filterAndSortOrders(orders.all, selectedFilter),
    [orders.all, selectedFilter],
  );
  const orderListHeight = getVirtualListHeight(
    filteredOrders.length,
    ORDER_LIST_ITEM_ESTIMATED_HEIGHT,
    ORDER_LIST_MAX_HEIGHT,
    ORDER_LIST_MIN_HEIGHT,
  );

  const loading = isLoading || isRefetching;
  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      onOpenChange(nextOpen);
      if (nextOpen) {
        clearSelectedOrderTimer();
        return;
      }

      clearSelectedOrderTimer();
      clearSelectedOrderTimerRef.current = setTimeout(() => {
        setSelectedOrder(undefined);
        clearSelectedOrderTimerRef.current = null;
      }, ORDER_HISTORY_CLOSE_RESET_DELAY);
    },
    [clearSelectedOrderTimer, onOpenChange],
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        presentation="center"
        className="w-[calc(100vw-1.5rem)] max-w-[560px] gap-0 overflow-y-auto rounded-[22px] border-border/80 p-0 shadow-[0_24px_90px_rgba(0,0,0,0.5)]"
      >
        {selectedOrder ? (
          <SelectedOrderDetails
            key={`${selectedOrder.id}-${selectedOrder.createdAt}`}
            rawOrder={selectedOrder}
            onBack={() => setSelectedOrder(undefined)}
            onCancelSuccess={() => setSelectedOrder(undefined)}
          />
        ) : (
          <>
            <DialogHeader className="px-5 pb-6 pt-5 text-left">
              <DialogTitle className="text-[16px] font-semibold leading-none">
                Order history
              </DialogTitle>
            </DialogHeader>

            <div className="flex flex-col gap-4 px-5 pb-5">
              <Select
                value={selectedFilter}
                onValueChange={(value) =>
                  setSelectedFilter(value as OrderFilter)
                }
              >
                <SelectTrigger className="h-10 w-full rounded-[13px] border-border/70 bg-secondary/35 px-3 text-sm font-medium text-foreground shadow-none transition-colors hover:border-primary/35 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25 sm:w-[144px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-[14px] border-border/80 bg-popover p-1 shadow-[0_18px_70px_rgba(0,0,0,0.45)]">
                  {ORDER_FILTER_OPTIONS.map((filter) => (
                    <SelectItem
                      key={filter}
                      value={filter}
                      className="h-10 rounded-[11px] text-muted-foreground hover:bg-secondary/45 hover:text-foreground focus:bg-secondary/45 focus:text-foreground data-[state=checked]:bg-primary/14 data-[state=checked]:text-foreground"
                    >
                      {getOrderFilterLabel(filter)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {loading && !filteredOrders.length ? (
                <div className="flex min-h-[320px] items-center justify-center">
                  <Spinner className="size-10" />
                </div>
              ) : filteredOrders.length ? (
                <div
                  className="overflow-hidden"
                  style={{ height: orderListHeight, maxHeight: "76dvh" }}
                >
                  <Virtuoso
                    style={{ height: "100%" }}
                    data={filteredOrders}
                    itemContent={(_, order) => (
                      <OrderListItem
                        order={order}
                        onSelect={setSelectedOrder}
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
      </DialogContent>
    </Dialog>
  );
}
