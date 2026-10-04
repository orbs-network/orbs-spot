import { getActiveClientPartnerConfig } from "./client";

export function getActiveLiquidityHubPartnerId(): string {
  const id = getActiveClientPartnerConfig().id;
  return id === "ginco" || id === "orbs" ? "playground" : id;
}
