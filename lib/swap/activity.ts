"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type SwapActivity = {
  hash: `0x${string}`;
  account: string;
  chainId: number;
  inputSymbol: string;
  outputSymbol: string;
  inputAmount: string;
  createdAt: number;
  status: "pending" | "confirmed" | "reverted";
};

export function validSwapActivity(value: unknown): value is SwapActivity {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<SwapActivity>;
  return typeof item.hash === "string" && /^0x[\da-f]{64}$/i.test(item.hash)
    && typeof item.account === "string" && /^0x[\da-f]{40}$/i.test(item.account)
    && Number.isSafeInteger(item.chainId) && Number(item.chainId) > 0
    && typeof item.createdAt === "number" && Number.isFinite(item.createdAt)
    && ["pending", "confirmed", "reverted"].includes(item.status ?? "")
    && typeof item.inputSymbol === "string" && typeof item.outputSymbol === "string"
    && typeof item.inputAmount === "string";
}

type ActivityState = {
  items: SwapActivity[];
  add: (item: SwapActivity) => void;
  settle: (chainId: number, hash: string, status: "confirmed" | "reverted") => void;
};

// Storage failures must never turn a broadcast transaction into a failed swap.
export const useSwapActivity = create<ActivityState>()(persist((set) => ({
  items: [],
  add: item => set(state => ({ items: [item, ...state.items.filter(existing => existing.chainId !== item.chainId || existing.hash !== item.hash)] })),
  settle: (chainId, hash, status) => set(state => {
    if (!state.items.some(item => item.chainId === chainId && item.hash === hash && item.status !== status)) return state;
    return { items: state.items.map(item => item.chainId === chainId && item.hash === hash ? { ...item, status } : item) };
  }),
}), {
  name: "orbs-swap-activity-v1",
  skipHydration: true,
  storage: createJSONStorage(() => ({
    getItem: key => { try { return localStorage.getItem(key); } catch { return null; } },
    setItem: (key, value) => { try { localStorage.setItem(key, value); } catch { /* Private browsing or full storage. */ } },
    removeItem: key => { try { localStorage.removeItem(key); } catch { /* Storage unavailable. */ } },
  })),
  partialize: state => ({ items: state.items.filter(item => item.status === "pending" || Date.now() - item.createdAt < 90 * 86_400_000) }),
  merge: (persisted, current) => {
    const items = (persisted as { items?: unknown } | undefined)?.items;
    return { ...current, items: Array.isArray(items) ? items.filter(validSwapActivity) : [] };
  },
}));
