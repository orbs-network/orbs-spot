import { SwapStatus } from "@orbs-network/swap-ui";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { Currency, FormTab, SwapStep } from "../types";
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
        set({ slippage, slippageMode: mode }),
      setPriceProtection: (priceProtection: number, mode = "custom") =>
        set({ priceProtection, priceProtectionMode: mode }),
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
  inputAmount: string;
  setInputAmount: (inputAmount: string) => void;
  pauseQuote: boolean;
  setPauseQuote: (pauseQuote: boolean) => void;
};

export const useSwapStore = create<SwapStore>((set) => ({
  inputAmount: "",
  setInputAmount: (inputAmount: string) => set({ inputAmount }),
  pauseQuote: false,
  setPauseQuote: (pauseQuote: boolean) => set({ pauseQuote }),
}));

type FormTabStore = {
  orderHistoryOpen: boolean;
  pendingTab?: FormTab;
  selectedTab: FormTab;
  clearPendingTab: () => void;
  setOrderHistoryOpen: (open: boolean) => void;
  setPendingTab: (tab: FormTab) => void;
  setSelectedTab: (tab: FormTab) => void;
};

export const useFormTabStore = create<FormTabStore>((set) => ({
  orderHistoryOpen: false,
  selectedTab: FormTab.SWAP,
  clearPendingTab: () => set({ pendingTab: undefined }),
  setOrderHistoryOpen: (open: boolean) => set({ orderHistoryOpen: open }),
  setPendingTab: (tab: FormTab) => set({ pendingTab: tab }),
  setSelectedTab: (tab: FormTab) => set({ selectedTab: tab }),
}));

type BestTradeSwapStore = {
  status?: SwapStatus;
  totalSteps?: number;
  currentStep?: SwapStep;
  currentStepIndex?: number;
  txHash?: string;
  updateStore: (data: Partial<BestTradeSwapStore>) => void;
  resetStore: () => void;
};

export const useBestTradeSwapStore = create<BestTradeSwapStore>((set) => ({
  updateStore: (data: Partial<BestTradeSwapStore>) =>
    set((state) => ({ ...state, ...data })),
  resetStore: () =>
    set({
      status: undefined,
      totalSteps: undefined,
      currentStep: undefined,
      currentStepIndex: undefined,
      txHash: undefined,
    }),
}));
