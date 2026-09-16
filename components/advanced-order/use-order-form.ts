"use client";

import { createContext, useContext, useMemo, useCallback } from "react";
import {
  calculateOrderForm,
  invertPriceInput,
  Module,
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

import type { OrderInput } from "@/lib/spot/form";
const EMPTY_INPUT: OrderInput = {};

/** Called once by AdvancedOrderForm. All consumers share this calculated snapshot. */
export function useCalculatedOrder(module: Module) {
  const { inputCurrency, outputCurrency, inputAmount } = useDerivedSwap();
  const chainId = useDataChainId();
  const { address } = useConnection();
  // Draft prices and schedules belong to a specific chain, module and token pair.
  const key = `${chainId}:${module}:${inputCurrency?.address}:${outputCurrency?.address}`;
  const input = useSwapStore((state) =>
    state.orderDraft.key === key ? state.orderDraft.input : EMPTY_INPUT,
  );
  const setOrderInput = useSwapStore((state) => state.setOrderInput);
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
  const form = useMemo(
    () =>
      calculateOrderForm({
        module,
        inputTokenDecimals: inputToken?.decimals ?? 18,
        outputTokenDecimals: outputToken?.decimals ?? 18,
        quotedOutputAmountRaw: quote,
        inputTokenUsdPrice: inputUsd?.toString(),
        outputTokenUsdPrice: outputUsd?.toString(),
        inputBalanceRaw: address ? balance : undefined,
        minTradeSizeUsd: 5,
        priceProtectionPercent: priceProtection,
        displayFeePercent: 0,
        userInput: {
          ...input,
          inputAmountUi: inputAmount,
          isMarketOrder:
            module !== Module.LIMIT && (input.isMarketOrder ?? true),
        },
      }),
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
      inputAmount,
    ],
  );
  return useMemo(
    () => ({ form, inputToken, outputToken, input, updateInput, market }),
    [form, inputToken, outputToken, input, updateInput, market],
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
  const { form, inputToken, updateInput } = useOrderModel();
  return {
    ...form.trades,
    inputToken,
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
    onInvert: () =>
      updateInput({
        isPriceInverted: !form.isInverted,
        limitPriceUi: invertPriceInput(input.limitPriceUi),
        triggerPriceUi: invertPriceInput(input.triggerPriceUi),
      }),
  };
}
export function useTriggerPrice() {
  const { form, updateInput } = useOrderModel();
  const { displayOutputToken } = usePriceDisplay();
  return {
    ...form.triggerPrice,
    price: form.triggerPrice.display,
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
  const { form, updateInput } = useOrderModel();
  const { displayOutputToken } = usePriceDisplay();
  return {
    ...form.limitPrice,
    price: form.limitPrice.display,
    displayOutputToken,
    isEnabled: !form.values.isMarketOrder,
    toggle: () => updateInput({ isMarketOrder: !form.values.isMarketOrder }),
    onInputChange: (limitPriceUi: string) =>
      updateInput({ limitPriceUi, limitPricePercent: null }),
    onPercentageChange: (limitPricePercent: string) =>
      updateInput({ limitPricePercent, limitPriceUi: undefined }),
    onReset: () =>
      updateInput({ limitPriceUi: undefined, limitPricePercent: undefined }),
  };
}
export function useInputErrors() {
  return useOrderForm().errors.primary;
}
export function useDisclaimer() {
  const form = useOrderForm();
  return form.values.isMarketOrder
    ? form.values.isTriggerPrice
      ? "triggerMarketPriceDisclaimer"
      : "marketOrderDisclaimer"
    : "limitOrderDisclaimer";
}
