"use client";

import { QueryParamProvider } from "use-query-params";
import NextAdapterApp from "next-query-params/app";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  return (
    <QueryParamProvider adapter={NextAdapterApp}>
      {children}
    </QueryParamProvider>
  );
}
