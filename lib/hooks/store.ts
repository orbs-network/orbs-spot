import { validPercent } from "../percent-settings";
import type { OrderInput } from "@/lib/spot/form";
import { ExecutionPhase, type ExecutionSnapshot } from "@/lib/spot/execution";
import { SwapStatus } from "@orbs-network/swap-ui";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { Currency, SwapStep } from "../types";
import { DEFAULT_PRICE_PROTECTION, DEFAULT_SLIPPAGE } from "../consts";
import { getTokenKey } from "../utils";

type CustomCurrencies = { [chainId: number]: Currency[] };
export type PercentSettingMode = "auto" | "custom";

type UserStore = {
  slippage: number;
  slippageMode: PercentSettingMode;
  setSlippage: (slippage: number, mode?: PercentSettingMode) => void;
  priceProtection: number;
  priceProtectionMode: PercentSettingMode;
  setPriceProtection: (
    priceProtection: number,
    mode?: PercentSettingMode,
  ) => void;
  customCurrencies: CustomCurrencies;
  setCustomCurrency: (chainId: number, currency: Currency) => void;
};

const getPersistedPercentMode = (
  value: number | undefined,
  defaultValue: number,
): PercentSettingMode => (value === undefined || value === defaultValue ? "auto" : "custom");

export const useUserStore = create<UserStore>()(
  persist(
    (set) => ({
      slippage: DEFAULT_SLIPPAGE,
      slippageMode: "auto",
      priceProtection: DEFAULT_PRICE_PROTECTION,
      priceProtectionMode: "auto",
      customCurrencies: {},
      setCustomCurrency: (chainId: number, currency: Currency) =>
        set((state) => ({
          customCurrencies: {
            ...state.customCurrencies,
            [chainId]: (state.customCurrencies[chainId] ?? [])
              .filter((it) => getTokenKey(it.address) !== getTokenKey(currency.address))
              .concat(currency),
          },
        })),
      setSlippage: (slippage: number, mode = "custom") =>
        set((state) => validPercent(slippage) ? { slippage, slippageMode: mode } : state),
      setPriceProtection: (priceProtection: number, mode = "custom") =>
        set((state) => validPercent(priceProtection) ? { priceProtection, priceProtectionMode: mode } : state),
    }),
    {
      name: "swap-store",
      storage: createJSONStorage(() => localStorage),
      version: 1,
      migrate: (persistedState, version) => {
        if (version >= 1) {
          return persistedState as UserStore;
        }

        const state = persistedState as Partial<UserStore>;

        return {
          ...state,
          slippageMode:
            state.slippageMode ??
            getPersistedPercentMode(state.slippage, DEFAULT_SLIPPAGE),
          priceProtectionMode:
            state.priceProtectionMode ??
            getPersistedPercentMode(
              state.priceProtection,
              DEFAULT_PRICE_PROTECTION,
            ),
        };
      },
    }
  )
);

type SwapStore = {
  orderDraft: { key: string; input: OrderInput };
  setOrderInput: (key: string, input: OrderInput) => void;
  inputAmount: string;
  setInputAmount: (inputAmount: string) => void;
  pauseQuote: boolean;
  setPauseQuote: (pauseQuote: boolean) => void;
};

export const useSwapStore = create<SwapStore>((set) => ({
  orderDraft: { key: "", input: {} },
  setOrderInput: (key, input) => set((state) => ({
    orderDraft: {
      key,
      input: {
        ...(state.orderDraft.key === key ? state.orderDraft.input : {}),
        ...input,
      },
    },
  })),
  inputAmount: "",
  setInputAmount: (inputAmount: string) => set({ inputAmount }),
  pauseQuote: false,
  setPauseQuote: (pauseQuote: boolean) => set({ pauseQuote }),
}));

type FormTabStore = {
  orderHistoryOpen: boolean;
  setOrderHistoryOpen: (open: boolean) => void;
};

export const useFormTabStore = create<FormTabStore>((set) => ({
  orderHistoryOpen: false,
  setOrderHistoryOpen: (open: boolean) => set({ orderHistoryOpen: open }),
}));

type OrderSubmitFlowStore = {
  isReviewOpen: boolean;
  setReviewOpen: (open: boolean) => void;
  execution: ExecutionSnapshot;
  pendingWrappedInputAddress?: string;
  pendingWrappedContext?: { chainId: number; account: string };
  setPendingWrappedInputAddress: (address?: string, context?: { chainId: number; account: string }) => void;
};

// Wrapping finishes while the submit dialog is still rendering the original
// native-token order. Queue the form update so that changing the input token
// cannot reset or alter the in-progress order flow.
export const useOrderSubmitFlowStore = create<OrderSubmitFlowStore>((set) => ({
  isReviewOpen: false,
  setReviewOpen: (isReviewOpen) => set({ isReviewOpen }),
  execution: { phase: ExecutionPhase.IDLE },
  pendingWrappedInputAddress: undefined,
  setPendingWrappedInputAddress: (pendingWrappedInputAddress, pendingWrappedContext) =>
    set({ pendingWrappedInputAddress, pendingWrappedContext }),
}));

type BestTradeSwapStore = {
  isReviewOpen: boolean;
  setReviewOpen: (open: boolean) => void;
  isAwaitingWallet?: boolean;
  review?: { inputCurrency: Currency; outputCurrency: Currency; inputAmount: string; outputAmount: string; chainId: number };
  status?: SwapStatus;
  totalSteps?: number;
  currentStep?: SwapStep;
  currentStepIndex?: number;
  txHash?: string;
  updateStore: (data: Partial<BestTradeSwapStore>) => void;
  resetStore: () => void;
};

export const useBestTradeSwapStore = create<BestTradeSwapStore>((set) => ({
  isReviewOpen: false,
  setReviewOpen: (isReviewOpen) => set({ isReviewOpen }),
  updateStore: (data: Partial<BestTradeSwapStore>) =>
    set((state) => ({ ...state, ...data })),
  resetStore: () =>
    set({
      status: undefined,
      totalSteps: undefined,
      currentStep: undefined,
      currentStepIndex: undefined,
      txHash: undefined,
      isAwaitingWallet: false,
      review: undefined,
    }),
}));
