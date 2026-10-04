import { getPartnerConfig } from "./config";

export function getActiveClientPartnerConfig() {
  const partnerId =
    typeof document === "undefined"
      ? process.env.NEXT_PARTNER
      : document.documentElement.dataset.partner;

  return getPartnerConfig(partnerId);
}

// The partner is fixed for the lifetime of the page.
export const IS_ORBS = getActiveClientPartnerConfig().id === "orbs";
