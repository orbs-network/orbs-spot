"use client";

import { useSelectedFormTab } from "@/lib/hooks/use-form-tab";
import { FormTab } from "@/lib/types";
import { AdvancedOrderContent } from "./advanced-order/content";
import { SpotProviderShell } from "./advanced-order/spot-provider-shell";
import { getModule } from "./advanced-order/utils";

export function AdvancedOrderForm({
  hidden,
}: {
  hidden?: boolean;
}) {
  const { selectedTab } = useSelectedFormTab();
  if (hidden) {
    return null;
  }

  const tab =
    selectedTab.value === FormTab.SWAP ? FormTab.TWAP : selectedTab.value;
  const orderModule = getModule(tab);

  return (
    <SpotProviderShell orderModule={orderModule}>
      <AdvancedOrderContent
        hidden={hidden}
        orderModule={orderModule}
      />
    </SpotProviderShell>
  );
}
