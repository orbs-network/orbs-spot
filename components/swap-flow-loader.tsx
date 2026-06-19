"use client";

import { Spinner } from "@/components/ui/spinner";

export function SwapFlowLoader() {
  return (
    <div className="flex size-18 items-center justify-center rounded-full border border-primary/20 bg-primary/10">
      <Spinner className="size-8 text-primary" />
    </div>
  );
}
