"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type OrderHistoryContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  openHistory: () => void;
};

const OrderHistoryContext = createContext<OrderHistoryContextValue | null>(
  null,
);

export function OrderHistoryProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const openHistory = useCallback(() => setOpen(true), []);

  const value = useMemo(
    () => ({
      open,
      setOpen,
      openHistory,
    }),
    [open, openHistory],
  );

  return (
    <OrderHistoryContext.Provider value={value}>
      {children}
    </OrderHistoryContext.Provider>
  );
}

export function useOrderHistoryModal() {
  const context = useContext(OrderHistoryContext);

  if (!context) {
    throw new Error(
      "useOrderHistoryModal must be used within OrderHistoryProvider",
    );
  }

  return context;
}
