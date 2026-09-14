"use client";

import { DownloadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DownloadIntegrationButton({ flow, getCode }: {
  flow: "liquidity-hub" | "advanced-orders";
  getCode: () => string;
}) {
  function download() {
    const setup = flow === "liquidity-hub"
      ? "Install: npm install @orbs-network/liquidity-hub-sdk viem\nConfigure: chainId, partner, and your connected wallet provider.\nCall swapFlow with your reviewed quote and refetchQuote callback."
      : "Install: npm install @orbs-network/spot-ui viem\nConfigure: chain, partner, and your connected wallet provider.\nThe calculation parameters below reflect the current saved form.\nCall createAdvancedOrderFlow with the wallet account and token addresses.";
    const blob = new Blob([`/*\n${setup}\nBrowser integration: import this module only on the client.\n*/\n\n`, getCode()], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${flow}.ts`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <Button type="button" variant="ghost" size="sm" className="h-10 shrink-0 px-2.5 text-[11px]" onClick={download}>
      <DownloadIcon aria-hidden="true" className="size-3.5" />
      Download code
    </Button>
  );
}
