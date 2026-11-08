"use client";

import { create } from "zustand";
import { OrderStatus, type Order, type Partners } from "@orbs-network/spot-ui";
import { replaceEqualDeep } from "@tanstack/react-query";

type PreviewAsset = {
  token: { symbol?: string; name?: string; logoUrl?: string; decimals?: number };
  amount?: string;
};

export type SubmissionPreview = {
  id: string;
  kind: "swap" | "order" | "wrap" | "unwrap";
  title: string;
  status: "pending" | "success" | "error";
  message?: string;
  input?: PreviewAsset;
  output?: PreviewAsset;
  /** Reviewed output in UI units, retained independently of the eventual fill. */
  swapQuote?: { outputAmount: string; outputAmountUsd?: string };
  chainId: number;
  account?: string;
  partner?: Partners;
  order?: Order;
  transactions?: { label: string; hash: string }[];
  details?: { label: string; value: string }[];
};

function sameOrder(previous: Order, next: Order): boolean {
  return previous.chainId === next.chainId && previous.historyKey === next.historyKey
    && previous.maker.toLowerCase() === next.maker.toLowerCase();
}

function latestOrder(previous: Order | undefined, next: Order | undefined): Order | undefined {
  if (!previous) return next;
  if (!next) return previous;
  if (!sameOrder(previous, next)) return previous;
  // An older history response must not reopen a completed/cancelled order.
  return previous.status !== OrderStatus.Open && next.status === OrderStatus.Open ? previous : next;
}

/** Submission previews are independent of the editable form and its foreground owner. */
export const useSubmissionPreview = create<{
  entries: Record<string, SubmissionPreview>;
  selectedId?: string;
  upsert(preview: SubmissionPreview): void;
  updateOrder(id: string, order: Order): void;
  open(id: string): void;
  close(): void;
}>((set) => ({
  entries: {},
  upsert: preview => set(state => {
    const entry: SubmissionPreview = {
      ...preview,
      input: preview.input && { ...preview.input, token: { ...preview.input.token } },
      output: preview.output && { ...preview.output, token: { ...preview.output.token } },
      swapQuote: preview.swapQuote && { ...preview.swapQuote },
      transactions: Array.from(new Map([...(state.entries[preview.id]?.transactions ?? []), ...(preview.transactions ?? [])]
        .map(transaction => [transaction.hash.toLowerCase(), { ...transaction }])).values()),
      details: preview.details?.map(detail => ({ ...detail })),
      order: replaceEqualDeep(state.entries[preview.id]?.order, structuredClone(latestOrder(state.entries[preview.id]?.order, preview.order))),
    };
    const entries = { ...state.entries, [preview.id]: entry };
    // Retain all active orders plus recent outcomes, without growing terminal history forever.
    const recent = new Set(Object.keys(entries).slice(-30));
    for (const [id, value] of Object.entries(entries)) {
      if (!recent.has(id) && id !== state.selectedId && value.status !== "pending" && value.order?.status !== OrderStatus.Open) delete entries[id];
    }
    return { entries };
  }),
  updateOrder: (id, order) => set(state => {
    const entry = state.entries[id];
    if (!entry?.order || !sameOrder(entry.order, order)) return state;
    const snapshot = replaceEqualDeep(entry.order, structuredClone(latestOrder(entry.order, order)));
    return snapshot === entry.order ? state : { entries: { ...state.entries, [id]: { ...entry, order: snapshot } } };
  }),
  open: id => set(state => state.entries[id] ? { selectedId: id } : state),
  close: () => set({ selectedId: undefined }),
}));

export const openSubmissionPreview = (id: string) => useSubmissionPreview.getState().open(id);
