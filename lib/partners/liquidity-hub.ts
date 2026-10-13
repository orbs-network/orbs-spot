import { getActiveClientPartnerConfig } from "./client";

export function getActiveLiquidityHubPartnerId(): string {
  const id = getActiveClientPartnerConfig().id;
  if (id === "orbs") return "external";
  return id === "ginco" ? "playground" : id;
}
