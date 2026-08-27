import { getActiveClientPartnerConfig } from "./client";

export function getActiveLiquidityHubPartnerId(): string {
  const id = getActiveClientPartnerConfig().id;
  return id === "ginco" ? "playground" : id;
}
