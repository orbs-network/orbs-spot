import { getPartnerConfig } from "./config";

export function getActivePartnerConfig() {
  return getPartnerConfig(process.env.NEXT_PARTNER);
}
