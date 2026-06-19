import { getPartnerConfig } from "./config";

export function getActiveClientPartnerConfig() {
  const partnerId =
    typeof document === "undefined"
      ? process.env.NEXT_PARTNER
      : document.documentElement.dataset.partner;

  return getPartnerConfig(partnerId);
}
