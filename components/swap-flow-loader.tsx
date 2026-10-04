"use client";

import { Spinner } from "@/components/ui/spinner";
import { AlertTriangleIcon } from "lucide-react";

export function SwapFlowLoader() {
  return <Spinner className="size-14 text-primary" />;
}

export function SwapFlowErrorIcon() {
  return (
    <div data-flow-error-icon className="flex size-14 items-center justify-center border border-destructive/30 text-destructive">
      <AlertTriangleIcon aria-hidden="true" className="size-7" strokeWidth={1.5} />
    </div>
  );
}
