import { defaultPartner } from "./default";
import { efficientFrontierPartner } from "./efficient-frontier";
import type { PartnerConfig } from "./types";

export type { PartnerConfig, PartnerStyles } from "./types";

export const DEFAULT_PARTNER = "default";
export const EFFICIENT_FRONTIER_PARTNER = "efficient-frontier";

export const PARTNERS = {
  [DEFAULT_PARTNER]: defaultPartner,
  [EFFICIENT_FRONTIER_PARTNER]: efficientFrontierPartner,
} as const satisfies Record<string, PartnerConfig>;

export type PartnerId = keyof typeof PARTNERS;

const PARTNER_ALIASES = {
  default: DEFAULT_PARTNER,
  main: DEFAULT_PARTNER,
  ef: EFFICIENT_FRONTIER_PARTNER,
  efficientfrontier: EFFICIENT_FRONTIER_PARTNER,
  "efficient-frontier": EFFICIENT_FRONTIER_PARTNER,
} as const satisfies Record<string, PartnerId>;

export function normalizePartnerId(value?: string) {
  const normalized = value?.trim().toLowerCase();

  if (!normalized) {
    return undefined;
  }

  if (normalized in PARTNER_ALIASES) {
    return PARTNER_ALIASES[normalized as keyof typeof PARTNER_ALIASES];
  }

  return normalized in PARTNERS ? (normalized as PartnerId) : undefined;
}

export function getPartnerConfig(partnerId?: string): PartnerConfig {
  const resolvedPartnerId = normalizePartnerId(partnerId) ?? DEFAULT_PARTNER;
  return PARTNERS[resolvedPartnerId];
}
