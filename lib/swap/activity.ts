"use client";

import { OrderStatus, type Order } from "@orbs-network/spot-ui";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

type ActivityDetails = {
  account: string;
  chainId: number;
  inputSymbol: string;
  outputSymbol: string;
  inputAmount: string;
  createdAt: number;
};

export type SwapActivityStatus = "pending" | "confirmed" | "reverted" | "cancelled" | "expired" | "unconfirmed";
export type SwapSettlementStatus = Exclude<SwapActivityStatus, "pending">;

// Keep the original transaction shape readable so existing browser history survives.
export type TransactionSwapActivity = ActivityDetails & {
  kind?: "transaction";
  hash: `0x${string}`;
  status: "pending" | "confirmed" | "reverted" | "unconfirmed";
};

export type SpotSwapActivity = ActivityDetails & {
  kind: "spot";
  orderId: string;
  order: Order;
  // A signed intent ID is not an on-chain transaction hash.
  txHash?: `0x${string}`;
  status: Exclude<SwapActivityStatus, "reverted">;
};

export type SwapActivity = TransactionSwapActivity | SpotSwapActivity;

const validHash = (value: unknown): value is `0x${string}` =>
  typeof value === "string" && /^0x[\da-f]{64}$/i.test(value);

export function getFillTransactionHash(order: Order): `0x${string}` | undefined {
  for (let index = order.fills.length - 1; index >= 0; index -= 1) {
    const hash = order.fills[index].txHash;
    if (validHash(hash)) return hash;
  }
  return undefined;
}

export function getSwapActivityId(item: SwapActivity): string {
  return item.kind === "spot" ? item.orderId : item.hash;
}

export function validSwapActivity(value: unknown): value is SwapActivity {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<ActivityDetails> & Record<string, unknown>;
  if (!(typeof item.account === "string" && /^0x[\da-f]{40}$/i.test(item.account)
    && Number.isSafeInteger(item.chainId) && Number(item.chainId) > 0
    && typeof item.createdAt === "number" && Number.isFinite(item.createdAt)
    && typeof item.inputSymbol === "string" && typeof item.outputSymbol === "string"
    && typeof item.inputAmount === "string")) return false;
  if (item.kind !== "spot") {
    return (item.kind === undefined || item.kind === "transaction") && validHash(item.hash)
      && ["pending", "confirmed", "reverted", "unconfirmed"].includes(String(item.status));
  }
  if (!item.order || typeof item.order !== "object") return false;
  const order = item.order as Partial<Order>;
  // These are the SDK tracker's identity/bounds and the only persisted fill data we read.
  return validHash(item.orderId) && order.id === item.orderId && order.chainId === item.chainId
    && typeof order.historyKey === "string" && order.historyKey.length > 0
    && typeof order.deadline === "number" && Number.isFinite(order.deadline) && order.deadline > 0
    && Object.values(OrderStatus).includes(order.status as OrderStatus)
    && Array.isArray(order.fills) && order.fills.every(fill => fill && typeof fill.txHash === "string")
    && (item.status !== "confirmed" || order.status === OrderStatus.Completed)
    && (item.txHash === undefined || validHash(item.txHash))
    && ["pending", "confirmed", "cancelled", "expired", "unconfirmed"].includes(String(item.status));
}

type ActivityState = {
  items: SwapActivity[];
  add: (item: SwapActivity) => void;
  settle: (chainId: number, identity: string, status: SwapSettlementStatus, order?: Order) => void;
};

// Storage failures must never turn an accepted intent into a failed swap.
export const useSwapActivity = create<ActivityState>()(persist((set) => ({
  items: [],
  add: item => set(state => ({ items: [item, ...state.items.filter(existing => existing.chainId !== item.chainId
    || getSwapActivityId(existing) !== getSwapActivityId(item))] })),
  settle: (chainId, identity, status, order) => set(state => {
    if (!state.items.some(item => item.chainId === chainId && getSwapActivityId(item) === identity && item.status !== status)) return state;
    return { items: state.items.map(item => {
      if (item.chainId !== chainId || getSwapActivityId(item) !== identity) return item;
      if (item.kind !== "spot") return status === "confirmed" || status === "reverted" || status === "unconfirmed" ? { ...item, status } : item;
      if (status === "reverted") return item;
      const snapshot = order?.id === item.orderId && order.chainId === chainId ? order : item.order;
      if (status === "confirmed" && snapshot.status !== OrderStatus.Completed) return item;
      return { ...item, order: snapshot, status, txHash: getFillTransactionHash(snapshot) };
    }) };
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
