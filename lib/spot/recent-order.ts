import { create } from "zustand";
import type { HistoryOrder } from "./order-tokens";
import { DEFAULT_SPOT_API_URL } from "./api";

export const useRecentOrder = create<{ key?: string; account?: string; apiUrl?: string; placedAt?: number; pending: HistoryOrder[]; add: (order: HistoryOrder) => void; indexed: (keys: Set<string>, apiUrl?: string) => void }>((set) => ({
  pending: [],
  add: order => set(state => {
    const apiUrl = order.apiUrl ?? DEFAULT_SPOT_API_URL;
    return { key: order.historyKey, account: order.maker.toLowerCase(), apiUrl, placedAt: Date.now(), pending: [
      { ...order, apiUrl },
      ...state.pending.filter(item => item.historyKey !== order.historyKey || (item.apiUrl ?? DEFAULT_SPOT_API_URL) !== apiUrl),
    ] };
  }),
  indexed: (keys, apiUrl = DEFAULT_SPOT_API_URL) => set(state => {
    const pending = state.pending.filter(order => (order.apiUrl ?? DEFAULT_SPOT_API_URL) !== apiUrl || !keys.has(order.historyKey));
    return pending.length === state.pending.length ? state : { pending };
  }),
}));
