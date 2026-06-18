/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { CurrencyCard } from "@/components/currency-card";
import { SubmitSwapButton } from "@/components/submit-swap-button";
import { SettingsModal } from "@/components/settings-modal";
import { ToggleCurrencies } from "@/components/toggle-currencies";
import { OrderHistoryModal } from "@/components/order-history-modal";
import { Button } from "@/components/ui/button";
import { CurrencyLogo } from "@/components/ui/currency-logo";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { NumericInput } from "@/components/ui/numeric-input";
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
import TokensPair from "@/components/tokens-pair";
import { useActionHandlers } from "@/lib/hooks/use-action-handlers";
import {
  useBalance,
  useRefetchSelectedCurrenciesBalances,
} from "@/lib/hooks/use-balances";
import { useFormatNumber } from "@/lib/hooks/common";
import { useDerivedSwap } from "@/lib/hooks/use-derived-swap";
import { useSettings } from "@/lib/hooks/use-settings";
import { useUSDPrice } from "@/lib/hooks/use-usd-price";
import { useTranslations } from "@/lib/use-translations";
import { Currency, Field, FormTab } from "@/lib/types";
import {
  cn,
  formatDecimals,
  getExplorerUrl,
  getWrappedNativeCurrency,
} from "@/lib/utils";
import { Step, SwapFlow } from "@orbs-network/swap-ui";
import {
  DISCLAIMER_URL,
  getNetwork,
  isNativeAddress,
  Module,
  ORBS_TWAP_FAQ_URL,
  Partners,
  SpotProvider,
  Steps,
  SwapStatus,
  TimeUnit,
  useExplorerLink,
  useNetwork,
  useSpot,
  type ApproveTokenProps,
  type Callbacks,
  type CancelOrderProps,
  type GetAllowanceProps,
  type OnApproveSuccessCallback,
  type OnCancelOrderSuccess,
  type OnWrapSuccessCallback,
  type Order,
  type ParsedError,
  type SignOrderProps,
  type Token,
  type WalletInteractions,
} from "@orbs-network/spot-react";
import BN from "bignumber.js";
import {
  AlertTriangleIcon,
  ArrowLeftRightIcon,
  InfoIcon,
} from "lucide-react";
import { type ReactNode, useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { type Abi, erc20Abi, maxUint256 } from "viem";
import { useConnection, usePublicClient, useWalletClient } from "wagmi";

const DURATION_OPTIONS = [
  { text: "Minutes", value: TimeUnit.Minutes },
  { text: "Hours", value: TimeUnit.Hours },
  { text: "Days", value: TimeUnit.Days },
] as const;

const MODULE_META = {
  [Module.TWAP]: {
    titleKey: "twapMarket",
  },
  [Module.LIMIT]: {
    titleKey: "limit",
  },
  [Module.STOP_LOSS]: {
    titleKey: "stopLoss",
  },
  [Module.TAKE_PROFIT]: {
    titleKey: "takeProfit",
  },
} as const;

const WRAP_TOAST_ID = "spot-wrap-token";
const APPROVE_TOAST_ID = "spot-approve-token";
const CREATE_ORDER_TOAST_ID = "spot-create-order";

function getModule(tab: FormTab) {
  switch (tab) {
    case FormTab.LIMIT:
      return Module.LIMIT;
    case FormTab.STOP_LOSS:
      return Module.STOP_LOSS;
    case FormTab.TAKE_PROFIT:
      return Module.TAKE_PROFIT;
    case FormTab.TWAP:
    default:
      return Module.TWAP;
  }
}

type Translate = ReturnType<typeof useTranslations>;

function getOrderTitle(orderModule: Module, t: Translate) {
  return t(MODULE_META[orderModule]?.titleKey ?? "placeOrder");
}

function useSpotToken(currency?: Currency) {
  return useMemo((): Token | undefined => {
    if (!currency) return undefined;

    return {
      address: currency.address,
      decimals: currency.decimals,
      symbol: currency.symbol,
      logoUrl: currency.logoUrl,
    };
  }, [currency]);
}

function useSpotMarketReferencePrice() {
  const { trade, isLoadingTrade, noLiquidity } = useDerivedSwap();

  return useMemo(
    () => ({
      value: trade?.outAmount,
      isLoading: isLoadingTrade,
      noLiquidity,
    }),
    [isLoadingTrade, noLiquidity, trade?.outAmount],
  );
}

function useWalletInteractions() {
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const { chainId } = useConnection();

  const waitForTx = useCallback(
    async (hash: `0x${string}`) => {
      if (!chainId) {
        throw new Error("Chain is not connected");
      }

      const result = await fetch(
        `/api/transaction-receipt?chainId=${chainId}&hash=${hash}`,
      );

      if (!result.ok) {
        throw new Error("Failed to get transaction receipt");
      }

      const receipt = await result.json();
      if (receipt?.status === "reverted") {
        throw new Error("Transaction reverted");
      }

      return hash;
    },
    [chainId],
  );

  return useMemo((): WalletInteractions => {
    const network = getNetwork(chainId);

    return {
      wrapNativeToken: async (amount: string) => {
        if (!walletClient) {
          throw new Error("Wallet client not found");
        }
        if (!network?.wToken?.address) {
          throw new Error("Wrapped native token not found for chain");
        }

        const hash = await walletClient.writeContract({
          abi: [
            {
              name: "deposit",
              type: "function",
              stateMutability: "payable",
              inputs: [],
              outputs: [],
            },
          ],
          functionName: "deposit",
          address: network.wToken.address as `0x${string}`,
          args: [],
          value: BigInt(amount),
          chain: walletClient.chain,
          account: walletClient.account!,
        });

        return waitForTx(hash);
      },
      approveToken: async (props: ApproveTokenProps) => {
        if (!walletClient) {
          throw new Error("Wallet client not found");
        }

        const hash = await walletClient.writeContract({
          abi: erc20Abi,
          functionName: "approve",
          address: props.tokenAddress as `0x${string}`,
          args: [props.spenderAddress as `0x${string}`, maxUint256],
          chain: walletClient.chain,
          account: walletClient.account!,
        });

        return waitForTx(hash);
      },
      cancelOrder: async (props: CancelOrderProps) => {
        if (!walletClient) {
          throw new Error("Wallet client not found");
        }

        const hash = await walletClient.writeContract({
          abi: props.abi as Abi,
          functionName: "cancel",
          address: props.contractAddress as `0x${string}`,
          args: props.args as any,
          chain: walletClient.chain,
          account: walletClient.account!,
        } as any);

        return waitForTx(hash);
      },
      signOrder: async (props: SignOrderProps) => {
        if (!walletClient) {
          throw new Error("Wallet client not found");
        }

        return walletClient.signTypedData({
          domain: props.domain as any,
          types: props.types as any,
          primaryType: props.primaryType,
          message: props.message as any,
          account: props.account,
        });
      },
      getAllowance: async (props: GetAllowanceProps) => {
        if (!publicClient) {
          throw new Error("Public client not found");
        }
        if (!walletClient?.account?.address) {
          throw new Error("Wallet account not found");
        }

        const result = await publicClient.readContract({
          address: props.tokenAddress as `0x${string}`,
          abi: erc20Abi,
          functionName: "allowance",
          args: [
            walletClient.account.address as `0x${string}`,
            props.spenderAddress as `0x${string}`,
          ],
        });

        return String(result);
      },
    };
  }, [chainId, publicClient, waitForTx, walletClient]);
}

function useSpotCallbacks() {
  const t = useTranslations();
  const { inputCurrency, outputCurrency } = useDerivedSwap();
  const { handleCurrencyChange } = useActionHandlers();
  const { chainId } = useConnection();
  const { mutateAsync: refetchBalances } =
    useRefetchSelectedCurrenciesBalances();

  const approvalSymbol = useMemo(() => {
    if (!inputCurrency) return "";
    if (isNativeAddress(inputCurrency.address)) {
      return getWrappedNativeCurrency(chainId)?.symbol ?? inputCurrency.symbol;
    }
    return inputCurrency.symbol;
  }, [chainId, inputCurrency]);

  const explorerLink = useCallback(
    (txHash?: string) => getExplorerUrl(chainId, txHash),
    [chainId],
  );

  const callbacks = useMemo((): Callbacks => {
    return {
      onWrapRequest: () => {
        toast.loading(
          `${t("wrapAction", { symbol: inputCurrency?.symbol ?? "token" })}...`,
          {
            id: WRAP_TOAST_ID,
            description: t("proceedInWallet"),
          },
        );
      },
      onWrapSuccess: async ({ txHash }: OnWrapSuccessCallback) => {
        const network = getNetwork(chainId);
        const wrappedAddress = network?.wToken?.address;

        if (wrappedAddress) {
          handleCurrencyChange(wrappedAddress, Field.INPUT);
        }

        toast.success(
          t("wrapAction", { symbol: inputCurrency?.symbol ?? "token" }),
          {
            id: WRAP_TOAST_ID,
            description: explorerLink(txHash) ? (
              <a href={explorerLink(txHash)} target="_blank" rel="noreferrer">
                {t("viewOnExplorer")}
              </a>
            ) : undefined,
          },
        );
        await refetchBalances();
      },
      onApproveRequest: () => {
        toast.loading(
          `${t("approveAction", { symbol: approvalSymbol || "token" })}...`,
          {
            id: APPROVE_TOAST_ID,
            description: t("proceedInWallet"),
          },
        );
      },
      onApproveSuccess: ({ txHash }: OnApproveSuccessCallback) => {
        toast.success(
          t("approveAction", { symbol: approvalSymbol || "token" }),
          {
            id: APPROVE_TOAST_ID,
            description: explorerLink(txHash) ? (
              <a href={explorerLink(txHash)} target="_blank" rel="noreferrer">
                {t("viewOnExplorer")}
              </a>
            ) : undefined,
          },
        );
      },
      onSignOrderRequest: () => {
        toast.loading(
          <TokensPair
            prefix={t("placeOrder")}
            srcTokenAddress={inputCurrency?.address}
            dstTokenAddress={outputCurrency?.address}
          />,
          { id: CREATE_ORDER_TOAST_ID, description: t("proceedInWallet") },
        );
      },
      onOrderCreated: (order: Order) => {
        toast.success(
          <TokensPair
            prefix={t("Completed")}
            srcTokenAddress={order.srcTokenAddress}
            dstTokenAddress={order.dstTokenAddress}
          />,
          {
            id: CREATE_ORDER_TOAST_ID,
            duration: 10_000,
            closeButton: true,
          },
        );
        refetchBalances();
      },
      onOrderFilled: (order: Order) => {
        toast.success(
          <TokensPair
            prefix={t("Completed")}
            srcTokenAddress={order.srcTokenAddress}
            dstTokenAddress={order.dstTokenAddress}
          />,
        );
        refetchBalances();
      },
      onSubmitOrderFailed: ({ code, message }: ParsedError) => {
        toast.error(
          code ? `Transaction failed: ${code}` : "Transaction failed",
          {
            id: CREATE_ORDER_TOAST_ID,
            description: message,
          },
        );
      },
      onSubmitOrderRejected: () => {
        toast.info("Order rejected in wallet", {
          id: CREATE_ORDER_TOAST_ID,
        });
      },
      onCancelOrderRequest: () => {
        toast.loading(`${t("cancelOrder")}...`, {
          description: t("proceedInWallet"),
        });
      },
      onCancelOrderSuccess: ({ txHash }: OnCancelOrderSuccess) => {
        toast.success(t("Cancelled"), {
          description: explorerLink(txHash) ? (
            <a href={explorerLink(txHash)} target="_blank" rel="noreferrer">
              {t("viewOnExplorer")}
            </a>
          ) : undefined,
        });
        refetchBalances();
      },
      onCancelOrderFailed: (error: Error) => {
        toast.error("Cancel failed", { description: error.message });
      },
      onOrdersProgressUpdate: () => {
        refetchBalances();
      },
      onCopy: () => {
        toast.success("Copied");
      },
    };
  }, [
    approvalSymbol,
    chainId,
    explorerLink,
    handleCurrencyChange,
    inputCurrency?.address,
    inputCurrency?.symbol,
    outputCurrency?.address,
    refetchBalances,
    t,
  ]);

  return callbacks;
}

function InlineSwitch({
  checked,
  onCheckedChange,
  ariaLabel,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative h-6 w-11 rounded-full border border-border/70 bg-secondary transition-colors",
        checked && "border-primary bg-primary",
      )}
    >
      <span
        className={cn(
          "absolute left-1 top-1 size-4 rounded-full bg-muted-foreground transition-transform",
          checked && "translate-x-5 bg-primary-foreground",
        )}
      />
    </button>
  );
}

function Panel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[22px] border border-border/70 bg-secondary/45 p-4",
        className,
      )}
    >
      {children}
    </div>
  );
}

function Label({
  children,
  hint,
  tooltip,
}: {
  children: ReactNode;
  hint?: ReactNode;
  tooltip?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <p className="text-sm font-medium text-muted-foreground">{children}</p>
      <SpotTooltip tooltipText={tooltip} />
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
}

function SpotTooltip({
  children,
  tooltipText,
}: {
  children?: ReactNode;
  tooltipText?: string;
}) {
  if (!tooltipText) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="text-muted-foreground transition-colors hover:text-foreground"
          aria-label="More information"
        >
          {children ?? <InfoIcon className="size-4" />}
        </button>
      </TooltipTrigger>
      <TooltipContent>{tooltipText}</TooltipContent>
    </Tooltip>
  );
}

function AppSelect<T extends number>({
  value,
  onChange,
  items,
}: {
  value: T;
  onChange: (value: T) => void;
  items: readonly { text: string; value: T }[];
}) {
  return (
    <Select
      value={String(value)}
      onValueChange={(nextValue) => {
        const item = items.find(
          (option) => String(option.value) === nextValue,
        );

        if (item) {
          onChange(item.value);
        }
      }}
    >
      <SelectTrigger className="h-11 min-w-[116px] rounded-[15px] border-border/70 bg-transparent px-3 text-sm font-medium text-foreground shadow-none transition-colors hover:border-primary/50 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="rounded-[18px] border-border/80 bg-popover p-1 shadow-[0_18px_70px_rgba(0,0,0,0.45)]">
        {items.map((item) => (
          <SelectItem
            key={item.value}
            value={String(item.value)}
            className="h-10 rounded-[14px] text-muted-foreground hover:bg-secondary hover:text-foreground focus:bg-secondary focus:text-foreground data-[state=checked]:bg-primary/14 data-[state=checked]:text-foreground"
          >
            {item.text}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function TokenPanel({ isSource }: { isSource: boolean }) {
  const t = useTranslations();
  const { inputCurrency, outputCurrency, inputAmount } = useDerivedSwap();
  const { value: dstAmount, isLoading } = useSpot().dstTokenPanel;
  const { handleCurrencyChange, setInputAmount } = useActionHandlers();

  const onTokenChange = useCallback(
    (currency: string) => {
      handleCurrencyChange(currency, isSource ? Field.INPUT : Field.OUTPUT);
    },
    [handleCurrencyChange, isSource],
  );

  return (
    <CurrencyCard
      currency={isSource ? inputCurrency : outputCurrency}
      onCurrencyChange={onTokenChange}
      onAmountChange={isSource ? setInputAmount : undefined}
      amount={isSource ? inputAmount : formatDecimals(dstAmount, 6)}
      title={isSource ? t("from") : t("to")}
      disabled={!isSource}
      isLoading={!isSource && Boolean(isLoading)}
    />
  );
}

function TradesPanel() {
  const t = useTranslations();
  const {
    totalTrades,
    onChange,
    amountPerTradeUI,
    amountPerTradeUsd,
    error,
    fromToken,
  } = useSpot().tradesAmountPanel;
  const amountPerTrade = useFormatNumber({ value: amountPerTradeUI });
  const amountPerTradeUsdFormatted = useFormatNumber({
    value: amountPerTradeUsd,
    decimalScale: 2,
  });
  const perTradeText = useMemo(() => {
    if (!fromToken || totalTrades === 1) return null;

    return (
      <>
        {amountPerTrade} {fromToken.symbol} per trade{" "}
        {amountPerTradeUsd && (
          <span className="text-foreground/50">
            (${amountPerTradeUsdFormatted})
          </span>
        )}
      </>
    );
  }, [
    amountPerTrade,
    amountPerTradeUsd,
    amountPerTradeUsdFormatted,
    fromToken,
    totalTrades,
  ]);

  return (
    <Panel
      className={cn(
        "flex flex-col justify-between gap-4 bg-secondary/35",
        error && "border-destructive/70",
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <Label tooltip={t("totalTradesTooltip")}>
          {t("tradesAmountTitle")}
        </Label>
        <p className="text-right text-[14px] font-medium text-foreground/80">
          {perTradeText}
        </p>
      </div>
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <NumericInput
            value={totalTrades ? totalTrades.toString() : ""}
            onChange={(value) => onChange(Number(value || 0))}
            decimalScale={0}
            className="text-[28px] font-medium leading-none border border-border/70 rounded-[15px] px-3 py-2"
          />
        </div>
        <span className="text-right text-[16px] font-medium leading-tight text-muted-foreground">
          Trades
        </span>
      </div>
    </Panel>
  );
}

function BorderedNumberField({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 cursor-text items-center rounded-[18px] border border-border/80 bg-transparent px-4 transition-colors hover:border-primary/55 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20",
        className,
      )}
    >
      {children}
    </div>
  );
}

function TimeInputPanel({ kind }: { kind: "duration" | "fillDelay" }) {
  const t = useTranslations();
  const durationPanel = useSpot().durationPanel;
  const fillDelayPanel = useSpot().fillDelayPanel;
  const value =
    kind === "duration"
      ? durationPanel.duration.value
      : fillDelayPanel.fillDelay.value;
  const unit =
    kind === "duration"
      ? durationPanel.duration.unit
      : fillDelayPanel.fillDelay.unit;
  const error =
    kind === "duration" ? durationPanel.error : fillDelayPanel.error;
  const onInputChange =
    kind === "duration"
      ? durationPanel.onInputChange
      : fillDelayPanel.onInputChange;
  const onUnitSelect =
    kind === "duration"
      ? durationPanel.onUnitSelect
      : fillDelayPanel.onUnitSelect;

  return (
    <Panel
      className={cn("flex flex-col gap-3", error && "border-destructive/70")}
    >
      <Label
        tooltip={
          kind === "duration"
            ? t("maxDurationTooltip")
            : t("tradeIntervalTooltip")
        }
      >
        {kind === "duration" ? t("expiry") : t("tradeIntervalTitle")}
      </Label>
      <div className="flex items-stretch gap-3">
        <BorderedNumberField className="h-14 flex-1">
          <NumericInput
            value={value ? value.toString() : ""}
            onChange={(nextValue) => onInputChange(nextValue)}
            decimalScale={0}
            className="text-[28px] font-semibold"
          />
        </BorderedNumberField>
        <AppSelect
          value={unit}
          items={DURATION_OPTIONS}
          onChange={(nextUnit) => onUnitSelect(nextUnit)}
        />
      </div>
    </Panel>
  );
}

function ModuleInputs({ orderModule }: { orderModule: Module }) {
  if (orderModule === Module.TWAP) {
    return (
      <>
        <TradesPanel />
        <TimeInputPanel kind="fillDelay" />
      </>
    );
  }

  return <TimeInputPanel kind="duration" />;
}

function SpotPriceInput({
  symbol,
  value,
  onChange,
  percentage,
  onPercentageChange,
  isLoading,
  usd,
}: {
  symbol?: string;
  value: string;
  onChange: (value: string) => void;
  percentage: string;
  onPercentageChange: (value: string) => void;
  isLoading?: boolean;
  usd?: string;
}) {
  const usdFormatted = useFormatNumber({ value: usd, decimalScale: 2 });
  const valueInputRef = useRef<HTMLInputElement>(null);
  const percentageInputRef = useRef<HTMLInputElement>(null);

  const focusValueInput = useCallback(() => {
    valueInputRef.current?.focus({ preventScroll: true });
  }, []);

  const focusPercentageInput = useCallback(() => {
    percentageInputRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_100px] gap-2">
      <div
        className="flex min-w-0 cursor-pointer items-center gap-3 rounded-[15px] border border-primary/45 bg-transparent px-3 py-2 text-foreground transition-colors hover:border-primary/70 focus-within:border-primary"
        onClick={focusValueInput}
      >
        <span className="min-w-0 truncate text-sm font-semibold text-muted-foreground">
          {symbol}
        </span>
        <div className="min-w-0 flex-1 text-right">
          <NumericInput
            ref={valueInputRef}
            isLoading={isLoading}
            value={value}
            onChange={onChange}
            className="text-right text-[20px] font-semibold text-foreground"
          />
          <p className="mt-1 min-h-4 text-xs text-muted-foreground">
            ${usdFormatted || "0"}
          </p>
        </div>
      </div>
      <div
        className="cursor-pointer rounded-[15px] border border-primary/45 bg-transparent px-2 py-2 text-foreground transition-colors hover:border-primary/70 focus-within:border-primary"
        onClick={focusPercentageInput}
      >
        <NumericInput
          ref={percentageInputRef}
          value={percentage}
          onChange={onPercentageChange}
          className="text-center text-[20px] font-semibold text-foreground"
          placeholder="0.0%"
          suffix="%"
          allowNegative
        />
      </div>
    </div>
  );
}

function PriceResetButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-sm font-semibold text-muted-foreground transition-colors hover:text-primary"
    >
      Set to default
    </button>
  );
}

function TriggerPricePanel({ orderModule }: { orderModule: Module }) {
  const t = useTranslations();
  const {
    priceUI: price,
    onInputChange,
    percentage,
    onPercentageChange,
    onReset,
    invertedDstToken,
    isTypedValue,
    usd,
    isLoading,
  } = useSpot().triggerPricePanel;

  if (orderModule !== Module.STOP_LOSS && orderModule !== Module.TAKE_PROFIT) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <Label
          tooltip={t(
            orderModule === Module.STOP_LOSS
              ? "stopLossTooltip"
              : "takeProfitTooltip",
          )}
        >
          {t("stopLossLabel")}
        </Label>
        <PriceResetButton onClick={onReset} />
      </div>
      <SpotPriceInput
        symbol={invertedDstToken?.symbol}
        value={isTypedValue ? price : formatDecimals(price, 6)}
        onChange={(value) => onInputChange(value)}
        percentage={percentage}
        onPercentageChange={(value) => onPercentageChange(value)}
        usd={usd}
        isLoading={isLoading}
      />
    </div>
  );
}

function LimitPricePanel({ orderModule }: { orderModule: Module }) {
  const t = useTranslations();
  const {
    onInputChange,
    priceUI,
    percentage,
    onPercentageChange,
    isLimitPrice,
    toggleLimitPrice,
    onReset,
    isLoading,
    invertedDstToken,
    isTypedValue,
    usd,
  } = useSpot().limitPricePanel;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        {orderModule !== Module.LIMIT && (
          <InlineSwitch
            checked={isLimitPrice}
            onCheckedChange={toggleLimitPrice}
            ariaLabel="Toggle limit price"
          />
        )}
        <div className="flex flex-1 items-center justify-between gap-3">
          <Label tooltip={t("limitPriceTooltip")}>{t("limitPrice")}</Label>
          {isLimitPrice && <PriceResetButton onClick={onReset} />}
        </div>
      </div>
      {isLimitPrice && (
        <SpotPriceInput
          symbol={invertedDstToken?.symbol}
          value={isTypedValue ? priceUI : formatDecimals(priceUI, 6)}
          onChange={(value) => onInputChange(value)}
          percentage={percentage}
          onPercentageChange={(value) => onPercentageChange(value)}
          isLoading={isLoading}
          usd={usd}
        />
      )}
    </div>
  );
}

function PricesHeader() {
  const { onInvert, isInverted, fromToken, isMarketPrice } =
    useSpot().pricePanel;

  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-sm font-semibold text-muted-foreground">
        {isInverted ? "Buy" : "Sell"} {fromToken?.symbol}{" "}
        {isMarketPrice ? "at best rate" : "at rate"}
      </p>
      {!isMarketPrice && (
        <Button
          variant="secondary"
          size="icon"
          className="rounded-2xl"
          onClick={onInvert}
          aria-label="Invert rate"
        >
          <ArrowLeftRightIcon className="size-4" />
        </Button>
      )}
    </div>
  );
}

function PricesPanel({ orderModule }: { orderModule: Module }) {
  return (
    <Panel className="flex flex-col gap-4">
      <PricesHeader />
      <TriggerPricePanel orderModule={orderModule} />
      <LimitPricePanel orderModule={orderModule} />
    </Panel>
  );
}

function formatInputError(
  error?: {
    type?: string;
    args?: Record<string, string>;
    value?: string | number;
  },
  t?: Translate,
) {
  if (!error?.type) return "";

  const translationKey =
    error.type === "missingLimitPrice" ? "emptyLimitPrice" : error.type;

  return t?.(translationKey, error.args) ?? translationKey;
}

function InputErrorPanel() {
  const t = useTranslations();
  const error = useSpot().inputError;
  const message = formatInputError(error, t);

  if (!message) {
    return null;
  }

  return (
    <div className="flex gap-2 rounded-[18px] border border-destructive/60 bg-destructive/12 p-3 text-sm font-medium text-foreground">
      <AlertTriangleIcon className="relative top-0.5 size-4 shrink-0 text-destructive" />
      <p className="flex-1">{message}</p>
    </div>
  );
}

function DisclaimerPanel() {
  const t = useTranslations();
  const disclaimer = useSpot().disclaimerPanel;

  if (!disclaimer) {
    return null;
  }

  return (
    <div className="flex gap-2 rounded-[18px] border border-border/60 bg-card/65 p-3">
      <InfoIcon className="relative top-0.5 size-4 shrink-0 text-muted-foreground" />
      <p className="flex-1 text-sm text-muted-foreground">
        {t(disclaimer)}{" "}
        <a
          href={ORBS_TWAP_FAQ_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-primary"
        >
          Learn more
        </a>
      </p>
    </div>
  );
}

function ReviewRow({
  label,
  children,
  hidden,
  tooltip,
}: {
  label: string;
  children: ReactNode;
  hidden?: boolean;
  tooltip?: string;
}) {
  if (hidden) return null;

  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        {label}
        <SpotTooltip tooltipText={tooltip} />
      </span>
      <span className="text-right font-medium">{children}</span>
    </div>
  );
}

function formatDuration(ms?: number) {
  if (!ms) return "";
  const minutes = Math.round(ms / TimeUnit.Minutes);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(ms / TimeUnit.Hours);
  if (hours < 48) return `${hours} hr`;
  const days = Math.round(ms / TimeUnit.Days);
  return `${days} days`;
}

function formatDeadline(deadline?: number) {
  if (!deadline) return "";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(deadline));
}

function TokenLogo({ token }: { token?: Token }) {
  return (
    <CurrencyLogo
      symbol={token?.symbol}
      logoUrl={token?.logoUrl}
      className="token-logo"
    />
  );
}

function OrderReviewDetails() {
  const t = useTranslations();
  const order = useSpot().derivedFormData;
  const srcToken = order.srcToken;
  const dstToken = order.dstToken;
  const minReceived = useFormatNumber({
    value: order.minDestAmountPerTradeUI,
    decimalScale: 4,
  });
  const sizePerTrade = useFormatNumber({
    value: order.sizePerTradeUI,
    decimalScale: 4,
  });
  const triggerPrice = useFormatNumber({
    value: order.triggerPriceUI,
    decimalScale: 5,
  });
  const limitPrice = useFormatNumber({
    value: order.limitPriceUI,
    decimalScale: 5,
  });
  const fees = useFormatNumber({ value: order.feesAmountUI, decimalScale: 4 });
  const feesUsd = useFormatNumber({ value: order.feesUsd, decimalScale: 2 });

  return (
    <div className="mt-3 flex w-full flex-col gap-2 rounded-[18px] border border-primary/25 bg-primary/10 p-3">
      <ReviewRow label={t("expirationLabel")} tooltip={t("expirationTooltip")}>
        {formatDeadline(order.deadline)}
      </ReviewRow>
      <ReviewRow
        label={t("triggerPrice")}
        tooltip={t("triggerPriceTooltip")}
        hidden={BN(order.triggerPriceUI || 0).isZero()}
      >
        1 {srcToken?.symbol} = {triggerPrice || "-"} {dstToken?.symbol}
      </ReviewRow>
      <ReviewRow
        label={t("limitPrice")}
        tooltip={t("limitPriceTooltip")}
        hidden={BN(order.limitPriceUI || 0).isZero()}
      >
        1 {srcToken?.symbol} = {limitPrice || "-"} {dstToken?.symbol}
      </ReviewRow>
      <ReviewRow
        label={
          order.totalTrades > 1 ? t("minReceivedPerTrade") : t("minReceived")
        }
        tooltip={t("minDstAmountTooltip")}
        hidden={BN(order.minDestAmountPerTradeUI || 0).isZero()}
      >
        {minReceived || "-"} {dstToken?.symbol}
      </ReviewRow>
      <ReviewRow
        label={t("individualTradeSize")}
        tooltip={t("tradeSizeTooltip")}
        hidden={order.totalTrades <= 1}
      >
        {sizePerTrade || "-"} {srcToken?.symbol}
      </ReviewRow>
      <ReviewRow
        label={t("numberOfTrades")}
        tooltip={t("totalTradesTooltip")}
        hidden={order.totalTrades <= 1}
      >
        {order.totalTrades}
      </ReviewRow>
      <ReviewRow
        label={t("tradeIntervalLabel")}
        tooltip={t("tradeIntervalTooltip")}
        hidden={order.totalTrades <= 1}
      >
        {formatDuration(order.tradeInterval)}
      </ReviewRow>
      <ReviewRow
        label={t("fees", { value: `(${order.feesPercentage}%)` })}
        hidden={!fees}
      >
        {fees} {dstToken?.symbol}
        {feesUsd ? ` ($${feesUsd})` : ""}
      </ReviewRow>
    </div>
  );
}

function TxError({ error }: { error?: ParsedError }) {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <AlertTriangleIcon className="size-8 text-destructive" />
      <h3 className="text-lg font-semibold">Transaction failed</h3>
      {error?.code ? (
        <p className="text-sm text-muted-foreground">
          Error code: {error.code}
        </p>
      ) : null}
      {error?.message ? (
        <p className="max-h-28 overflow-auto text-sm text-muted-foreground">
          {error.message}
        </p>
      ) : null}
    </div>
  );
}

function useOrderStep(orderTitle: string, srcToken?: Token): Step | undefined {
  const t = useTranslations();
  const { step, wrapTxHash, approveTxHash, status } =
    useSpot().orderExecutionPanel;
  const network = useNetwork();
  const wrapExplorerUrl = useExplorerLink(wrapTxHash);
  const approveExplorerUrl = useExplorerLink(approveTxHash);
  const symbol = isNativeAddress(srcToken?.address ?? "")
    ? (network?.native?.symbol ?? srcToken?.symbol ?? "")
    : (srcToken?.symbol ?? "");

  return useMemo(() => {
    if (step === Steps.WRAP) {
      return {
        title: t("wrapAction", { symbol }),
        footerLink: wrapExplorerUrl,
        footerText: wrapExplorerUrl
          ? t("viewOnExplorer")
          : t("proceedInWallet"),
      };
    }
    if (step === Steps.APPROVE) {
      return {
        title: t("approveAction", { symbol }),
        footerLink: approveExplorerUrl,
        footerText: approveExplorerUrl
          ? t("viewOnExplorer")
          : t("proceedInWallet"),
      };
    }
    return {
      title: t("createOrderAction", { name: orderTitle }),
      footerText:
        status === SwapStatus.LOADING ? t("proceedInWallet") : undefined,
    };
  }, [
    approveExplorerUrl,
    orderTitle,
    status,
    step,
    symbol,
    t,
    wrapExplorerUrl,
  ]);
}

function OrderFlowMain({
  onSubmit,
  isSubmitting,
  orderTitle,
}: {
  onSubmit: () => void;
  isSubmitting?: boolean;
  orderTitle: string;
}) {
  const t = useTranslations();
  const [accepted, setAccepted] = useState(true);
  const { status } = useSpot().orderExecutionPanel;
  const isSubmitted = Boolean(status);

  return (
    <>
      <SwapFlow.Main
        fromTitle={t("from")}
        toTitle={t("to")}
        inUsd={<OrderUsd kind="src" />}
        outUsd={<OrderUsd kind="dst" />}
      />
      {!isSubmitted && (
        <div className="mt-3 flex w-full flex-col gap-3">
          <OrderReviewDetails />
          <div className="flex w-full items-center justify-between gap-3 rounded-[18px] bg-secondary/55 p-3">
            <a
              href={DISCLAIMER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Accept Disclaimer
            </a>
            <InlineSwitch
              checked={accepted}
              onCheckedChange={setAccepted}
              ariaLabel="Accept order disclaimer"
            />
          </div>
          <Button
            className="h-14 w-full rounded-[18px] text-base"
            disabled={!accepted || isSubmitting}
            isLoading={Boolean(isSubmitting)}
            onClick={onSubmit}
          >
            {t("createOrderAction", { name: orderTitle })}
          </Button>
        </div>
      )}
    </>
  );
}

function OrderUsd({ kind }: { kind: "src" | "dst" }) {
  const order = useSpot().derivedFormData;
  const value = kind === "src" ? order.srcAmountUsd : order.dstAmountUsd;
  const formatted = useFormatNumber({ value, decimalScale: 2 });
  return <p className="text-sm text-muted-foreground">${formatted || "0"}</p>;
}

function OrderFlowSuccess({ orderTitle }: { orderTitle: string }) {
  const t = useTranslations();

  return (
    <SwapFlow.Success
      title={t("createOrderActionSuccess", { name: orderTitle })}
    />
  );
}

function SubmitOrderPanel({
  orderTitle,
  onSubmit,
  isSubmitting,
}: {
  orderTitle: string;
  onSubmit: () => void;
  isSubmitting?: boolean;
}) {
  const { status, stepIndex, totalSteps, parsedError, srcToken, dstToken } =
    useSpot().orderExecutionPanel;
  const order = useSpot().derivedFormData;
  const srcAmount = useFormatNumber({
    value: order.srcAmountUI,
    decimalScale: 4,
  });
  const dstAmount = useFormatNumber({
    value: order.dstAmountUI,
    decimalScale: 4,
  });
  const currentStep = useOrderStep(orderTitle, srcToken);
  const inToken = useMemo(
    () => ({ symbol: srcToken?.symbol, logoUrl: srcToken?.logoUrl }),
    [srcToken],
  );
  const outToken = useMemo(
    () => ({ symbol: dstToken?.symbol, logoUrl: dstToken?.logoUrl }),
    [dstToken],
  );

  return (
    <SwapFlow
      inAmount={srcAmount}
      outAmount={dstAmount}
      swapStatus={status}
      totalSteps={totalSteps}
      currentStep={currentStep}
      currentStepIndex={stepIndex}
      inToken={inToken}
      outToken={outToken}
      components={{
        SrcTokenLogo: <TokenLogo token={srcToken} />,
        DstTokenLogo: <TokenLogo token={dstToken} />,
        Failed: <SwapFlow.Failed error={<TxError error={parsedError} />} />,
        Success: <OrderFlowSuccess orderTitle={orderTitle} />,
        Main: (
          <OrderFlowMain
            onSubmit={onSubmit}
            isSubmitting={isSubmitting}
            orderTitle={orderTitle}
          />
        ),
        Loader: <Spinner className="size-18" />,
      }}
    />
  );
}

function SubmitOrder({ orderModule }: { orderModule: Module }) {
  const t = useTranslations();
  const {
    onSubmit,
    status,
    resetState,
    resetCurrentSwap,
    parsedError,
    confirmButtonLoading,
  } = useSpot().orderExecutionPanel;
  const { disabled, loading } = useSpot().submitOrderButton;
  const { setInputAmount } = useActionHandlers();
  const { chainId } = useConnection();
  const [open, setOpen] = useState(false);
  const orderTitle = getOrderTitle(orderModule, t);

  const onOpen = useCallback(() => {
    setOpen(true);
    if (status !== SwapStatus.LOADING) {
      resetCurrentSwap();
    }
  }, [resetCurrentSwap, setOpen, status]);

  const closeReview = useCallback(() => {
    setOpen(false);
    if (status === SwapStatus.SUCCESS) {
      setInputAmount("");
      window.setTimeout(resetState, 400);
    } else if (status) {
      window.setTimeout(resetCurrentSwap, 400);
    }
  }, [resetCurrentSwap, resetState, setInputAmount, setOpen, status]);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => (nextOpen ? onOpen() : closeReview())}
    >
      <SubmitSwapButton
        onClick={onOpen}
        disabled={disabled}
        isLoading={loading}
        text={loading ? t("fetchingQuote") : t("placeOrder")}
        validateSwap={false}
        chainId={chainId}
      />
      <DialogContent
        presentation="center"
        className="w-[calc(100vw-1rem)] sm:max-w-[560px]"
      >
        <DialogHeader>
          <DialogTitle>
            {parsedError ? "Error Creating Order" : `${orderTitle} order`}
          </DialogTitle>
        </DialogHeader>
        <SubmitOrderPanel
          orderTitle={orderTitle}
          onSubmit={onSubmit}
          isSubmitting={confirmButtonLoading}
        />
      </DialogContent>
    </Dialog>
  );
}

function AdvancedOrderContent({ orderModule }: { orderModule: Module }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <TokenPanel isSource />
        <ToggleCurrencies />
        <TokenPanel isSource={false} />
      </div>
      <PricesPanel orderModule={orderModule} />
      <ModuleInputs orderModule={orderModule} />
      <InputErrorPanel />
      <SettingsModal />
      <SubmitOrder orderModule={orderModule} />
      <DisclaimerPanel />
      <OrderHistoryModal />
    </div>
  );
}

export function AdvancedOrderForm({ tab }: { tab: FormTab }) {
  const orderModule = useMemo(() => getModule(tab), [tab]);
  const { inputCurrency, outputCurrency, inputAmount } = useDerivedSwap();
  const { chainId, address } = useConnection();
  const walletInteractions = useWalletInteractions();
  const callbacks = useSpotCallbacks();
  const inputBalance = useBalance(inputCurrency).wei;
  const outputBalance = useBalance(outputCurrency).wei;
  const inputUsd = useUSDPrice({ token: inputCurrency?.address });
  const outputUsd = useUSDPrice({ token: outputCurrency?.address });
  const spotSrcToken = useSpotToken(inputCurrency);
  const spotDstToken = useSpotToken(outputCurrency);
  const marketReferencePrice = useSpotMarketReferencePrice();
  const { priceProtection } = useSettings();

  return (
    <SpotProvider
      chainId={chainId}
      typedInputAmount={inputAmount}
      walletInteractions={walletInteractions}
      account={address}
      partner={Partners.Agent}
      srcBalance={inputBalance}
      dstBalance={outputBalance}
      srcToken={spotSrcToken}
      dstToken={spotDstToken}
      srcUsd1Token={(inputUsd.data ?? 0).toString()}
      dstUsd1Token={(outputUsd.data ?? 0).toString()}
      priceProtection={priceProtection}
      module={orderModule}
      marketReferencePrice={marketReferencePrice}
      minChunkSizeUsd={5}
      callbacks={callbacks}
      fees={0.25}
      isDev={false}
      enableQueryParams={false}
    >
      <AdvancedOrderContent orderModule={orderModule} />
    </SpotProvider>
  );
}
