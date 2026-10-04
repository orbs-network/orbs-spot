import type { PartnerConfig } from "./types";

export function hasOrbsConnectModal(
  partner: PartnerConfig,
  override = process.env.NEXT_PUBLIC_ORBS_CONNECT_MODAL,
): boolean {
  return partner.id === "orbs" && partner.features?.customConnectModal === true && override !== "false";
}
