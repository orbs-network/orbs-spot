import type { PartnerConfig } from "./types";

export function hasOrbsConnectModal(
  partner: PartnerConfig,
  override = process.env.NEXT_PUBLIC_ORBS_CONNECT_MODAL,
): boolean {
  return partner.features?.customConnectModal === true && override !== "false";
}
