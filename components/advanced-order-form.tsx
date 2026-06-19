"use client";

import { useFormTabStore } from "@/lib/hooks/store";
import { FormTab } from "@/lib/types";
import { useMemo } from "react";
import { AdvancedOrderContent } from "./advanced-order/content";
import { SpotProviderShell } from "./advanced-order/spot-provider-shell";
import { getModule } from "./advanced-order/utils";

export function AdvancedOrderForm({
  hidden,
}: {
  hidden?: boolean;
}) {
  const selectedTab = useFormTabStore((state) => state.selectedTab);
  const tab = selectedTab === FormTab.SWAP ? FormTab.TWAP : selectedTab;
  const orderModule = useMemo(() => getModule(tab), [tab]);

  return (
    <SpotProviderShell orderModule={orderModule}>
      <AdvancedOrderContent
        hidden={hidden}
        orderModule={orderModule}
      />
    </SpotProviderShell>
  );
}
