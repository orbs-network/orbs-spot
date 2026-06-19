/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { CurrencyCard } from "@/components/currency-card";
import { CurrencySelector } from "@/components/currency-selector";
import { FormActionPanel } from "@/components/form-action-panel";
import { SubmitSwapButton } from "@/components/submit-swap-button";
import { SettingsModal } from "@/components/settings-modal";
import { ToggleCurrencies } from "@/components/toggle-currencies";
import { OrderHistoryModal } from "@/components/order-history-modal";
import { SwapFlowLoader } from "@/components/swap-flow-loader";
import { Button } from "@/components/ui/button";
import { DetailRow } from "@/components/ui/detail-row";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormLabel } from "@/components/ui/form-label";
import { FormNumberField } from "@/components/ui/form-number-field";
import { FormPanel } from "@/components/ui/form-panel";
import { InlineMessage } from "@/components/ui/inline-message";
import { NumericInput } from "@/components/ui/numeric-input";
import { StyledSelect } from "@/components/ui/styled-select";
import { SwapFlowTokenLogo } from "@/components/ui/swap-flow-token-logo";
import { Switch } from "@/components/ui/switch";
import { TokenSelectorTrigger } from "@/components/ui/token-selector-trigger";
import TokensPair from "@/components/tokens-pair";
import { useActionHandlers } from "@/lib/hooks/use-action-handlers";
import {
  useBalance,
  useRefetchSelectedCurrenciesBalances,
} from "@/lib/hooks/use-balances";
import { useFormatNumber } from "@/lib/hooks/common";
import { useDataChainId } from "@/lib/hooks/use-data-chain-id";
import { useDerivedSwap } from "@/lib/hooks/use-derived-swap";
import { useCurrency } from "@/lib/hooks/use-currencies";
import { useSettings } from "@/lib/hooks/use-settings";
import { useFormTabStore } from "@/lib/hooks/store";
import {
  isUserRejectedError,
  showTransactionRejectedToast,
} from "@/lib/tx-rejection";
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
import { getActiveClientPartnerConfig } from "@/lib/partners/client";

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
const CANCEL_ORDER_TOAST_ID = "spot-cancel-order";

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

        try {
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
        } catch (error) {
          if (isUserRejectedError(error)) {
            showTransactionRejectedToast({ id: WRAP_TOAST_ID });
          }

          throw error;
        }
      },
      approveToken: async (props: ApproveTokenProps) => {
        if (!walletClient) {
          throw new Error("Wallet client not found");
        }

        try {
          const hash = await walletClient.writeContract({
            abi: erc20Abi,
            functionName: "approve",
            address: props.tokenAddress as `0x${string}`,
            args: [props.spenderAddress as `0x${string}`, maxUint256],
            chain: walletClient.chain,
            account: walletClient.account!,
          });

          return waitForTx(hash);
        } catch (error) {
          if (isUserRejectedError(error)) {
            showTransactionRejectedToast({ id: APPROVE_TOAST_ID });
          }

          throw error;
        }
      },
      cancelOrder: async (props: CancelOrderProps) => {
        if (!walletClient) {
          throw new Error("Wallet client not found");
        }

        try {
          const hash = await walletClient.writeContract({
            abi: props.abi as Abi,
            functionName: "cancel",
            address: props.contractAddress as `0x${string}`,
            args: props.args as any,
            chain: walletClient.chain,
            account: walletClient.account!,
          } as any);

          return waitForTx(hash);
        } catch (error) {
          if (isUserRejectedError(error)) {
            showTransactionRejectedToast({ id: CANCEL_ORDER_TOAST_ID });
          }

          throw error;
        }
      },
      signOrder: async (props: SignOrderProps) => {
        if (!walletClient) {
          throw new Error("Wallet client not found");
        }

        try {
          return await walletClient.signTypedData({
            domain: props.domain as any,
            types: props.types as any,
            primaryType: props.primaryType,
            message: props.message as any,
            account: props.account,
          });
        } catch (error) {
          if (isUserRejectedError(error)) {
            showTransactionRejectedToast({ id: CREATE_ORDER_TOAST_ID });
          }

          throw error;
        }
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
        if (isUserRejectedError({ code, message })) {
          showTransactionRejectedToast({ id: CREATE_ORDER_TOAST_ID });
          return;
        }

        toast.error(
          code ? `Transaction failed: ${code}` : "Transaction failed",
          {
            id: CREATE_ORDER_TOAST_ID,
            description: message,
          },
        );
      },
      onSubmitOrderRejected: () => {
        showTransactionRejectedToast({ id: CREATE_ORDER_TOAST_ID });
      },
      onCancelOrderRequest: () => {
        toast.loading(`${t("cancelOrder")}...`, {
          id: CANCEL_ORDER_TOAST_ID,
          description: t("proceedInWallet"),
        });
      },
      onCancelOrderSuccess: ({ txHash }: OnCancelOrderSuccess) => {
        toast.success(t("Cancelled"), {
          id: CANCEL_ORDER_TOAST_ID,
          description: explorerLink(txHash) ? (
            <a href={explorerLink(txHash)} target="_blank" rel="noreferrer">
              {t("viewOnExplorer")}
            </a>
          ) : undefined,
        });
        refetchBalances();
      },
      onCancelOrderFailed: (error: Error) => {
        if (isUserRejectedError(error)) {
          showTransactionRejectedToast({ id: CANCEL_ORDER_TOAST_ID });
          return;
        }

        toast.error("Cancel failed", {
          id: CANCEL_ORDER_TOAST_ID,
          description: error.message,
        });
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

function OrderNumericInputPanel<TUnit extends number>({
  decimalScale = 0,
  error,
  onChange,
  rightHint,
  staticUnitLabel,
  title,
  tooltip,
  unit,
  unitOptions,
  onUnitChange,
  value,
}: {
  decimalScale?: number;
  error?: unknown;
  onChange: (value: string) => void;
  rightHint?: ReactNode;
  staticUnitLabel?: string;
  title: ReactNode;
  tooltip?: string;
  unit?: TUnit;
  unitOptions?: readonly { text: string; value: TUnit }[];
  onUnitChange?: (value: TUnit) => void;
  value?: string;
}) {
  const hasUnitSelect = unit !== undefined && unitOptions && onUnitChange;

  return (
    <FormPanel
      variant="muted"
      className={cn(
        "flex flex-col justify-between gap-3",
        Boolean(error) && "border-destructive/70",
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <FormLabel tooltip={tooltip}>{title}</FormLabel>
        {rightHint ? (
          <p className="text-right text-sm font-medium text-foreground/80">
            {rightHint}
          </p>
        ) : null}
      </div>
      <div className="flex items-stretch gap-3">
        <FormNumberField className="h-13 min-w-0 flex-1">
          <NumericInput
            value={value ?? ""}
            onChange={onChange}
            decimalScale={decimalScale}
            className="text-[20px] font-semibold"
          />
        </FormNumberField>
        {hasUnitSelect ? (
          <div className="w-[132px] shrink-0 self-stretch">
            <StyledSelect
              value={unit}
              options={unitOptions.map((option) => ({
                label: option.text,
                value: option.value,
              }))}
              onValueChange={onUnitChange}
            />
          </div>
        ) : staticUnitLabel ? (
          <p className="mt-auto mb-2 text-sm font-medium text-muted-foreground">{staticUnitLabel}</p>
        ) : null}
      </div>
    </FormPanel>
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
          <span className="text-xs text-foreground/50">
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
    <OrderNumericInputPanel
      title={t("tradesAmountTitle")}
      tooltip={t("totalTradesTooltip")}
      value={totalTrades ? totalTrades.toString() : ""}
      onChange={(value) => onChange(Number(value || 0))}
      rightHint={perTradeText}
      staticUnitLabel="Trades"
      error={error}
    />
  );
}

function TimeInputPanel({ kind }: { kind: "duration" | "fillDelay" }) {
  const t = useTranslations();
  const durationPanel = useSpot().durationPanel;
  const fillDelayPanel = useSpot().fillDelayPanel;

  return (
    <OrderNumericInputPanel
      title={kind === "duration" ? t("expiry") : t("tradeIntervalTitle")}
      tooltip={
        kind === "duration" ? t("maxDurationTooltip") : t("tradeIntervalTooltip")
      }
      value={
        kind === "duration"
          ? durationPanel.duration.value?.toString() || ""
          : fillDelayPanel.fillDelay.value?.toString() || ""
      }
      onChange={
        kind === "duration"
          ? durationPanel.onInputChange
          : fillDelayPanel.onInputChange
      }
      unit={
        kind === "duration"
          ? durationPanel.duration.unit
          : fillDelayPanel.fillDelay.unit
      }
      unitOptions={DURATION_OPTIONS}
      onUnitChange={
        kind === "duration"
          ? durationPanel.onUnitSelect
          : fillDelayPanel.onUnitSelect
      }
      error={kind === "duration" ? durationPanel.error : fillDelayPanel.error}
    />
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

function PriceTokenSelector({
  className,
  fallbackClassName,
  field,
  logoClassName,
  token,
}: {
  className?: string;
  fallbackClassName: string;
  field: Field;
  logoClassName: string;
  token?: Token;
}) {
  const currency = useCurrency(token?.address);
  const { handleCurrencyChange } = useActionHandlers();
  const onCurrencyChange = useCallback(
    (currency: Currency) => handleCurrencyChange(currency.address, field),
    [field, handleCurrencyChange],
  );

  return (
    <CurrencySelector
      onCurrencyChange={onCurrencyChange}
      trigger={
        <TokenSelectorTrigger
          currency={currency}
          symbol={token?.symbol}
          logoUrl={token?.logoUrl || currency?.logoUrl}
          className={cn(
            "-mx-1 gap-1.5 px-1 py-0.5 hover:bg-primary/8 hover:text-foreground",
            className,
          )}
          logoClassName={logoClassName}
          fallbackClassName={fallbackClassName}
        />
      }
    />
  );
}

function SpotPriceInput({
  token,
  tokenField,
  value,
  onChange,
  percentage,
  onPercentageChange,
  usd,
}: {
  token?: Token;
  tokenField: Field;
  value: string;
  onChange: (value: string) => void;
  percentage: string;
  onPercentageChange: (value: string) => void;
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
    <div className="grid grid-cols-[minmax(0,1fr)_90px] gap-2">
      <FormNumberField
        className="flex min-w-0 items-center gap-3 rounded-[12px] border border-border/80 bg-transparent px-3 py-2 text-foreground transition-colors focus-within:border-primary"
        onClick={focusValueInput}
      >
        <PriceTokenSelector
          token={token}
          field={tokenField}
          logoClassName="size-5"
          fallbackClassName="text-[8px]"
          className="text-base font-semibold text-foreground"
        />
        <div className="min-w-0 flex-1 text-right">
          <NumericInput
            ref={valueInputRef}
            value={value}
            onChange={onChange}
            className="text-right text-[20px] font-semibold text-foreground"
          />
          <p className="text-sm text-muted-foreground">
            ${usdFormatted || "0"}
          </p>
        </div>
      </FormNumberField>
      <FormNumberField
        className="cursor-pointer rounded-[12px] border border-border/80 bg-transparent px-2 py-2 text-foreground transition-colors focus-within:border-primary"
        onClick={focusPercentageInput}
      >
        <NumericInput
          ref={percentageInputRef}
          value={percentage}
          onChange={onPercentageChange}
          className="text-center text-[18px] font-semibold text-foreground"
          placeholder="0.0%"
          suffix="%"
          allowNegative
        />
      </FormNumberField>
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
  const { isInverted } = useSpot().pricePanel;
  const {
    priceUI: price,
    onInputChange,
    percentage,
    onPercentageChange,
    onReset,
    invertedDstToken,
    isTypedValue,
    usd,
  } = useSpot().triggerPricePanel;

  if (orderModule !== Module.STOP_LOSS && orderModule !== Module.TAKE_PROFIT) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <FormLabel
          tooltip={t(
            orderModule === Module.STOP_LOSS
              ? "stopLossTooltip"
              : "takeProfitTooltip",
          )}
        >
          {t("stopLossLabel")}
        </FormLabel>
        <PriceResetButton onClick={onReset} />
      </div>
      <SpotPriceInput
        token={invertedDstToken}
        tokenField={isInverted ? Field.INPUT : Field.OUTPUT}
        value={isTypedValue ? price : formatDecimals(price, 6)}
        onChange={(value) => onInputChange(value)}
        percentage={percentage}
        onPercentageChange={(value) => onPercentageChange(value)}
        usd={usd}
      />
    </div>
  );
}

function LimitPricePanel({ orderModule }: { orderModule: Module }) {
  const t = useTranslations();
  const { isInverted } = useSpot().pricePanel;
  const {
    onInputChange,
    priceUI,
    percentage,
    onPercentageChange,
    isLimitPrice,
    toggleLimitPrice,
    onReset,
    invertedDstToken,
    isTypedValue,
    usd,
  } = useSpot().limitPricePanel;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        {orderModule !== Module.LIMIT && (
          <Switch
            checked={isLimitPrice}
            onCheckedChange={toggleLimitPrice}
            aria-label="Toggle limit price"
          />
        )}
        <div className="flex flex-1 items-center justify-between gap-3">
          <FormLabel tooltip={t("limitPriceTooltip")}>
            {t("limitPrice")}
          </FormLabel>
          {isLimitPrice && <PriceResetButton onClick={onReset} />}
        </div>
      </div>
      {isLimitPrice && (
        <SpotPriceInput
          token={invertedDstToken}
          tokenField={isInverted ? Field.INPUT : Field.OUTPUT}
          value={isTypedValue ? priceUI : formatDecimals(priceUI, 6)}
          onChange={(value) => onInputChange(value)}
          percentage={percentage}
          onPercentageChange={(value) => onPercentageChange(value)}
          usd={usd}
        />
      )}
    </div>
  );
}

function PricesHeader() {
  const { onInvert, isInverted, fromToken, isMarketPrice } =
    useSpot().pricePanel;
  const fromTokenField = isInverted ? Field.OUTPUT : Field.INPUT;

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-muted-foreground">
        <span>{isInverted ? "Buy" : "Sell"}</span>
        <PriceTokenSelector
          token={fromToken}
          field={fromTokenField}
          logoClassName="size-4"
          fallbackClassName="text-[7px]"
        />
        <span className="shrink-0">
          {isMarketPrice ? "at best rate" : "at rate"}
        </span>
      </div>
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
    <FormPanel className="flex flex-col gap-4">
      <PricesHeader />
      <TriggerPricePanel orderModule={orderModule} />
      <LimitPricePanel orderModule={orderModule} />
    </FormPanel>
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
    <InlineMessage
      variant="error"
      icon={
        <AlertTriangleIcon className="relative top-0.5 size-4 shrink-0 text-destructive" />
      }
    >
      <p className="flex-1">{message}</p>
    </InlineMessage>
  );
}

function DisclaimerPanel() {
  const t = useTranslations();
  const disclaimer = useSpot().disclaimerPanel;

  if (!disclaimer) {
    return null;
  }

  return (
    <InlineMessage
      icon={
        <InfoIcon className="relative top-1 size-4 shrink-0 text-muted-foreground" />
      }
    >
      <p className="flex-1 text-[14px] text-muted-foreground">
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
    </InlineMessage>
  );
}

function formatDurationUnit(value: number, unit: string) {
  return `${value} ${unit}${value === 1 ? "" : "s"}`;
}

function formatDuration(ms?: number) {
  if (!ms) return "";
  const minutes = Math.round(ms / TimeUnit.Minutes);
  if (minutes < 60) return formatDurationUnit(minutes, "Minute");
  const hours = Math.round(ms / TimeUnit.Hours);
  if (hours < 48) return formatDurationUnit(hours, "Hour");
  const days = Math.round(ms / TimeUnit.Days);
  return formatDurationUnit(days, "Day");
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

function OrderReviewDetails({ orderTitle }: { orderTitle: string }) {
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
  });
  const triggerPrice = useFormatNumber({
    value: order.triggerPriceUI,
  });
  const limitPrice = useFormatNumber({
    value: order.limitPriceUI,
  });
  const feesUsd = useFormatNumber({ value: order.feesUsd, decimalScale: 2 });

  return (
    <div className="mt-3 flex w-full flex-col gap-2 rounded-[14px] border border-primary/25 bg-primary/10 p-3">
      <DetailRow label={t("orderType")} align="start">
        {orderTitle}
      </DetailRow>
      <DetailRow
        label={t("expirationLabel")}
        tooltip={t("expirationTooltip")}
        align="start"
      >
        {formatDeadline(order.deadline)}
      </DetailRow>
      <DetailRow
        label={t("triggerPrice")}
        tooltip={t("triggerPriceTooltip")}
        hidden={BN(order.triggerPriceUI || 0).isZero()}
        align="start"
      >
        1 {srcToken?.symbol} = {triggerPrice || "-"} {dstToken?.symbol}
      </DetailRow>
      <DetailRow
        label={t("limitPrice")}
        tooltip={t("limitPriceTooltip")}
        hidden={BN(order.limitPriceUI || 0).isZero()}
        align="start"
      >
        1 {srcToken?.symbol} = {limitPrice || "-"} {dstToken?.symbol}
      </DetailRow>
      <DetailRow
        label={
          order.totalTrades > 1 ? t("minReceivedPerTrade") : t("minReceived")
        }
        tooltip={t("minDstAmountTooltip")}
        hidden={BN(order.minDestAmountPerTradeUI || 0).isZero()}
        align="start"
      >
        {minReceived || "-"} {dstToken?.symbol}
      </DetailRow>
      <DetailRow
        label={t("individualTradeSize")}
        tooltip={t("tradeSizeTooltip")}
        hidden={order.totalTrades <= 1}
        align="start"
      >
        {sizePerTrade || "-"} {srcToken?.symbol}
      </DetailRow>
      <DetailRow
        label={t("numberOfTrades")}
        tooltip={t("totalTradesTooltip")}
        hidden={order.totalTrades <= 1}
        align="start"
      >
        {order.totalTrades}
      </DetailRow>
      <DetailRow
        label={t("tradeIntervalLabel")}
        tooltip={t("tradeIntervalTooltip")}
        hidden={order.totalTrades <= 1}
        align="start"
      >
        {formatDuration(order.tradeInterval)}
      </DetailRow>
      <DetailRow
        label={t("fees", { value: `(${order.feesPercentage}%)` })}
        hidden={!feesUsd}
        align="start"
      >
        ${feesUsd}
      </DetailRow>
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

function useOrderStep(srcToken?: Token): Step | undefined {
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
      title: t("createOrder"),
      footerText:
        status === SwapStatus.LOADING ? t("proceedInWallet") : undefined,
    };
  }, [
    approveExplorerUrl,
    status,
    step,
    symbol,
    t,
    wrapExplorerUrl,
  ]);
}

function OrderFlowMain({
  orderTitle,
  onSubmit,
  isSubmitting,
}: {
  orderTitle: string;
  onSubmit: () => void;
  isSubmitting?: boolean;
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
          <OrderReviewDetails orderTitle={orderTitle} />
          <div className="flex w-full items-center justify-between gap-3 rounded-[14px] bg-secondary/55 p-3">
            <a
              href={DISCLAIMER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="border-b border-muted-foreground/60 text-sm font-medium text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
            >
              Accept Disclaimer
            </a>
            <Switch
              checked={accepted}
              onCheckedChange={setAccepted}
              aria-label="Accept order disclaimer"
            />
          </div>
          <Button
            data-submit-button
            className="h-12 w-full rounded-[14px] text-base"
            disabled={!accepted || isSubmitting}
            isLoading={Boolean(isSubmitting)}
            onClick={onSubmit}
          >
            Submit order
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
  const currentStep = useOrderStep(srcToken);
  const inToken = useMemo(
    () => ({ symbol: srcToken?.symbol, logoUrl: srcToken?.logoUrl }),
    [srcToken],
  );
  const outToken = useMemo(
    () => ({ symbol: dstToken?.symbol, logoUrl: dstToken?.logoUrl }),
    [dstToken],
  );
  const srcCurrency = useCurrency(srcToken?.address);
  const dstCurrency = useCurrency(dstToken?.address);
  const tokenLogoClassName = status ? "size-[26px]" : "size-10";

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
        SrcTokenLogo: (
          <SwapFlowTokenLogo
            token={srcToken}
            currency={srcCurrency}
            className={tokenLogoClassName}
          />
        ),
        DstTokenLogo: (
          <SwapFlowTokenLogo
            token={dstToken}
            currency={dstCurrency}
            className={tokenLogoClassName}
          />
        ),
        Failed: <SwapFlow.Failed error={<TxError error={parsedError} />} />,
        Success: <OrderFlowSuccess orderTitle={orderTitle} />,
        Main: (
          <OrderFlowMain
            orderTitle={orderTitle}
            onSubmit={onSubmit}
            isSubmitting={isSubmitting}
          />
        ),
        Loader: <SwapFlowLoader />,
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
        className="w-[calc(100vw-1rem)] sm:max-w-[460px]"
      >
        <DialogHeader>
          <DialogTitle>
            {parsedError ? "Error Creating Order" : !status ? t("orderReview") : ''}
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

function AdvancedOrderContent({
  hidden,
  orderModule,
}: {
  hidden?: boolean;
  orderModule: Module;
}) {
  const orderHistoryOpen = useFormTabStore((state) => state.orderHistoryOpen);
  const setOrderHistoryOpen = useFormTabStore(
    (state) => state.setOrderHistoryOpen,
  );

  return (
    <>
      <div
        aria-hidden={hidden}
        className={cn("flex flex-col gap-3", hidden && "hidden")}
      >
        <div className="flex flex-col gap-1.5">
          <TokenPanel isSource />
          <ToggleCurrencies />
          <TokenPanel isSource={false} />
        </div>
        <PricesPanel orderModule={orderModule} />
        <ModuleInputs orderModule={orderModule} />
        <InputErrorPanel />
        <FormActionPanel>
          <SettingsModal triggerVariant="action" />
          <SubmitOrder orderModule={orderModule} />
        </FormActionPanel>
        <DisclaimerPanel />
      </div>
      <OrderHistoryModal
        open={orderHistoryOpen}
        onOpenChange={setOrderHistoryOpen}
      />
    </>
  );
}

function SpotProviderShell({
  children,
  orderModule,
}: {
  children: ReactNode;
  orderModule: Module;
}) {
  const { inputCurrency, outputCurrency, inputAmount } = useDerivedSwap();
  const { chainId, address } = useConnection();
  const dataChainId = useDataChainId();
  const spotChainId = chainId ?? dataChainId;
  const spotAccount = chainId ? address : undefined;
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
      chainId={spotChainId}
      typedInputAmount={inputAmount}
      walletInteractions={walletInteractions}
      account={spotAccount}
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
      minChunkSizeUsd={10}
      callbacks={callbacks}
      fees={0.25}
      isDev={false}
      appId={getActiveClientPartnerConfig().id}
      enableQueryParams={false}
    >
      {children}
    </SpotProvider>
  );
}

export function AdvancedOrderForm({
  hidden,
}: {
  hidden?: boolean;
}) {
  const selectedTab = useFormTabStore((state) => state.selectedTab);
  const tab = selectedTab === FormTab.SWAP ? FormTab.TWAP : selectedTab;
  const orderModule = useMemo(() => getModule(tab), [tab]);

  return (
    <SpotProviderShell orderModule={orderModule}>
      <AdvancedOrderContent
        hidden={hidden}
        orderModule={orderModule}
      />
    </SpotProviderShell>
  );
}
