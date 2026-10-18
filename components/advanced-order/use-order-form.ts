"use client";

import { createContext, useContext, useMemo, useCallback } from "react";
import {
  calculateOrderForm,
  invertPriceInput,
  Module,
  type CalculateOrderFormParams,
  type TimeUnit,
} from "@orbs-network/spot-ui";
import { useConnection } from "wagmi";
import { useDerivedSwap } from "@/lib/hooks/use-derived-swap";
import { useBalance } from "@/lib/hooks/use-balances";
import { useUSDPrice } from "@/lib/hooks/use-usd-price";
import { useSettings } from "@/lib/hooks/use-settings";
import { useSwapStore } from "@/lib/hooks/store";
import { useDataChainId } from "@/lib/hooks/use-data-chain-id";
import { useSpotMarketReferencePrice, useSpotToken } from "./hooks";

import { getOrderDraftKey, usesMarketPrice, type OrderInput } from "@/lib/spot/form";
import { useSelectedFormTab } from "@/lib/hooks/use-form-tab";
import { FormTab } from "@/lib/types";
import { getModule } from "./utils";
import { formatAmount } from "@/lib/token-display";
import BN from "bignumber.js";
import { invertPricePercentage } from "@/lib/exchange-rates";
const EMPTY_INPUT: OrderInput = {};

/** Called once by AdvancedOrderForm. All consumers share this calculated snapshot. */
export function useCalculatedOrder(module: Module) {
  const { inputCurrency, outputCurrency, inputAmount } = useDerivedSwap();
  const chainId = useDataChainId();
  const { address } = useConnection();
  // Draft prices and schedules belong to a specific chain, module and token pair.
  const key = getOrderDraftKey(chainId, module, inputCurrency?.address, outputCurrency?.address);
  const input = useSwapStore((state) =>
    state.orderDraft.key === key ? state.orderDraft.input : EMPTY_INPUT,
  );
  const setOrderInput = useSwapStore((state) => state.setOrderInput);
  // The toggle is a user preference, independent of pair-specific draft prices.
  const limitPriceEnabled = useSwapStore((state) => state.orderLimitPriceEnabled);
  const updateInput = useCallback(
    (patch: OrderInput) => setOrderInput(key, patch),
    [key, setOrderInput],
  );
  const inputToken = useSpotToken(inputCurrency);
  const outputToken = useSpotToken(outputCurrency);
  const balance = useBalance(inputCurrency).wei;
  const inputUsd = useUSDPrice({ token: inputCurrency?.address }).data;
  const outputUsd = useUSDPrice({ token: outputCurrency?.address }).data;
  const { priceProtection } = useSettings();
  const market = useSpotMarketReferencePrice();
  // Do not validate a new input against a quote that is still being refreshed.
  const quote = market.isLoading ? undefined : market.value;
  // Calculation is synchronous derived data, so useMemo is enough. The SDK
  // owns raw amounts, defaults and validation; only editable inputs live in the store.
  const { form, defaultPrices } = useMemo(
    () => {
      // A price cannot drop by 100% or more. Let the SDK validate these as zero prices.
      const triggerPercent = BN(input.triggerPricePercent ?? "").lte(-100) ? "-100" : input.triggerPricePercent;
      const limitPercent = BN(input.limitPricePercent ?? "").lte(-100) ? "-100" : input.limitPricePercent;
      const params: CalculateOrderFormParams = {
        module,
        inputTokenDecimals: inputToken?.decimals ?? 18,
        outputTokenDecimals: outputToken?.decimals ?? 18,
        quotedOutputAmountRaw: quote,
        inputTokenUsdPrice: inputUsd?.toString(),
        outputTokenUsdPrice: outputUsd?.toString(),
        inputBalanceRaw: address ? balance : undefined,
        minTradeSizeUsd: 10,
        priceProtectionPercent: priceProtection,
        displayFeePercent: 0,
        userInput: {
          ...input,
          // Editable percentages follow the displayed pair. The SDK uses the original pair.
          triggerPricePercent: input.isPriceInverted ? invertPricePercentage(triggerPercent) : triggerPercent,
          limitPricePercent: input.isPriceInverted ? invertPricePercentage(limitPercent) : limitPercent,
          inputAmountUi: inputAmount,
          isMarketOrder:
            usesMarketPrice(module, limitPriceEnabled),
        },
      };
      const form = calculateOrderForm(params);
      const defaults = calculateOrderForm({
        ...params,
        userInput: {
          ...params.userInput,
          triggerPriceUi: undefined,
          triggerPricePercent: undefined,
          limitPriceUi: undefined,
          limitPricePercent: module === Module.STOP_LOSS || module === Module.TAKE_PROFIT ? undefined : "0",
        },
      });
      return { form, defaultPrices: { trigger: defaults.triggerPrice.raw, limit: defaults.limitPrice.raw } };
    },
    [
      module,
      inputToken?.decimals,
      outputToken?.decimals,
      quote,
      inputUsd,
      outputUsd,
      address,
      balance,
      priceProtection,
      input,
      limitPriceEnabled,
      inputAmount,
    ],
  );
  return useMemo(
    () => ({ form, defaultPrices, inputToken, outputToken, input, updateInput, market }),
    [form, defaultPrices, inputToken, outputToken, input, updateInput, market],
  );
}

export const OrderFormContext = createContext<
  ReturnType<typeof useCalculatedOrder> | undefined
>(undefined);
export function useOrderModel() {
  const model = useContext(OrderFormContext);
  if (!model)
    throw new Error("Order controls must be inside AdvancedOrderForm");
  return model;
}
export function useOrderForm() {
  return useOrderModel().form;
}
export function useOutputAmount() {
  const { form, market } = useOrderModel();
  return { amount: form.outputAmount, isLoading: market.isLoading };
}
export function useTrades() {
  const { form, input, inputToken, updateInput } = useOrderModel();
  return {
    ...form.trades,
    inputToken,
    isAuto: input.tradeCount === undefined,
    resetToAuto: () => updateInput({ tradeCount: undefined }),
    onChange: (tradeCount: number) => updateInput({ tradeCount }),
  };
}
export function useDuration() {
  const { form, updateInput } = useOrderModel();
  const duration = form.schedule.duration;
  return {
    duration,
    error: form.schedule.durationError,
    onInputChange: (value: string) =>
      updateInput({ orderDuration: { ...duration, value: Number(value) } }),
    onUnitSelect: (unit: TimeUnit) =>
      updateInput({ orderDuration: { ...duration, unit } }),
  };
}
export function useFillDelay() {
  const { form, updateInput } = useOrderModel();
  const fillDelay = form.schedule.fillDelay;
  return {
    fillDelay,
    error: form.schedule.fillDelayError,
    onInputChange: (value: string) =>
      updateInput({ tradeInterval: { ...fillDelay, value: Number(value) } }),
    onUnitSelect: (unit: TimeUnit) =>
      updateInput({ tradeInterval: { ...fillDelay, unit } }),
  };
}
export function usePriceDisplay() {
  const { form, input, updateInput, inputToken, outputToken } = useOrderModel();
  return {
    inputToken,
    outputToken,
    isInverted: form.isInverted,
    isMarketOrder: form.values.isMarketOrder,
    displayInputToken: form.isInverted ? outputToken : inputToken,
    displayOutputToken: form.isInverted ? inputToken : outputToken,
    marketRate: formatAmount(form.isInverted ? invertPriceInput(form.marketPrice.ui) : form.marketPrice.ui),
    onInvert: () =>
      updateInput({
        isPriceInverted: !form.isInverted,
        limitPriceUi: invertPriceInput(input.limitPriceUi),
        triggerPriceUi: invertPriceInput(input.triggerPriceUi),
        triggerPricePercent: invertPricePercentage(input.triggerPricePercent),
        limitPricePercent: invertPricePercentage(input.limitPricePercent),
      }),
  };
}
export function useTriggerPrice() {
  const { form, defaultPrices, market, input, updateInput } = useOrderModel();
  const { displayOutputToken } = usePriceDisplay();
  return {
    ...form.triggerPrice,
    canReset: !market.isLoading && BN(defaultPrices.trigger).gt(0) && !BN(form.triggerPrice.raw).eq(defaultPrices.trigger),
    percentage: input.triggerPricePercent ?? (form.isInverted ? invertPricePercentage(form.triggerPrice.percentage) ?? "" : form.triggerPrice.percentage),
    price: form.triggerPrice.display,
    inputValue: input.triggerPriceUi ?? formatAmount(form.triggerPrice.display.ui),
    displayOutputToken,
    onInputChange: (triggerPriceUi: string) =>
      updateInput({ triggerPriceUi, triggerPricePercent: null }),
    onPercentageChange: (triggerPricePercent: string) =>
      updateInput({ triggerPricePercent, triggerPriceUi: undefined }),
    onReset: () =>
      updateInput({
        triggerPriceUi: undefined,
        triggerPricePercent: undefined,
      }),
  };
}
export function useLimitPrice() {
  const { form, defaultPrices, market, input, updateInput } = useOrderModel();
  const setLimitPriceEnabled = useSwapStore((state) => state.setOrderLimitPriceEnabled);
  const { displayOutputToken } = usePriceDisplay();
  return {
    ...form.limitPrice,
    canReset: !market.isLoading && BN(defaultPrices.limit).gt(0) && !BN(form.limitPrice.raw).eq(defaultPrices.limit),
    percentage: input.limitPricePercent ?? (form.isInverted ? invertPricePercentage(form.limitPrice.percentage) ?? "" : form.limitPrice.percentage),
    price: form.limitPrice.display,
    inputValue: input.limitPriceUi ?? formatAmount(form.limitPrice.display.ui),
    displayOutputToken,
    isEnabled: !form.values.isMarketOrder,
    toggle: () => setLimitPriceEnabled(form.values.isMarketOrder),
    onInputChange: (limitPriceUi: string) =>
      updateInput({ limitPriceUi, limitPricePercent: null }),
    onPercentageChange: (limitPricePercent: string) =>
      updateInput({ limitPricePercent, limitPriceUi: undefined }),
    onReset: () =>
      updateInput({
        limitPriceUi: undefined,
        limitPricePercent:
          form.module === Module.STOP_LOSS || form.module === Module.TAKE_PROFIT
            ? undefined
            : "",
      }),
  };
}
export function useInputErrors() {
  return useOrderForm().errors.primary;
}
export function useDisclaimer() {
  const { selectedTab } = useSelectedFormTab();
  const limitPriceEnabled = useSwapStore(state => state.orderLimitPriceEnabled);
  if (selectedTab.value === FormTab.SWAP) return undefined;
  const orderModule = getModule(selectedTab.value);
  return usesMarketPrice(orderModule, limitPriceEnabled)
    ? orderModule === Module.STOP_LOSS || orderModule === Module.TAKE_PROFIT
      ? "triggerMarketPriceDisclaimer"
      : "marketOrderDisclaimer"
    : "limitOrderDisclaimer";
}
