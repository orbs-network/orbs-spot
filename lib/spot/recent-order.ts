import { create } from "zustand";
import type { Order } from "@orbs-network/spot-ui";

export const useRecentOrder = create<{ key?: string; account?: string; placedAt?: number; pending: Order[]; add: (order: Order) => void; indexed: (keys: Set<string>) => void }>((set) => ({
  pending: [],
  add: order => set(state => ({ key: order.historyKey, account: order.maker.toLowerCase(), placedAt: Date.now(), pending: [order, ...state.pending.filter(item => item.historyKey !== order.historyKey)] })),
  indexed: keys => set(state => state.pending.some(order => keys.has(order.historyKey)) ? { pending: state.pending.filter(order => !keys.has(order.historyKey)) } : state),
}));
