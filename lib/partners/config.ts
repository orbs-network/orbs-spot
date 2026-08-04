import { defaultPartner } from "./default";
import { crymboPartner } from "./crymbo";
import { efficientFrontierPartner } from "./efficient-frontier";
import { gincoPartner } from "./ginco";
import { htDigitalPartner } from "./ht-digital";
import type { PartnerConfig } from "./types";

export type { PartnerConfig, PartnerStyles } from "./types";

export const DEFAULT_PARTNER = "default";
export const CRYMBO_PARTNER = "crymbo";
export const EFFICIENT_FRONTIER_PARTNER = "efficient-frontier";
export const GINCO_PARTNER = "ginco";
export const HT_DIGITAL_PARTNER = "ht-digital";

export const PARTNERS = {
  [DEFAULT_PARTNER]: defaultPartner,
  [CRYMBO_PARTNER]: crymboPartner,
  [EFFICIENT_FRONTIER_PARTNER]: efficientFrontierPartner,
  [GINCO_PARTNER]: gincoPartner,
  [HT_DIGITAL_PARTNER]: htDigitalPartner,
} as const satisfies Record<string, PartnerConfig>;

export type PartnerId = keyof typeof PARTNERS;

const PARTNER_ALIASES = {
  default: DEFAULT_PARTNER,
  main: DEFAULT_PARTNER,
  crymbo: CRYMBO_PARTNER,
  "crymbo.com": CRYMBO_PARTNER,
  crymbotech: CRYMBO_PARTNER,
  ef: EFFICIENT_FRONTIER_PARTNER,
  efficientfrontier: EFFICIENT_FRONTIER_PARTNER,
  "efficient-frontier": EFFICIENT_FRONTIER_PARTNER,
  ginco: GINCO_PARTNER,
  gincoenterprise: GINCO_PARTNER,
  "ginco-enterprise-wallet": GINCO_PARTNER,
  ht: HT_DIGITAL_PARTNER,
  "ht.digital": HT_DIGITAL_PARTNER,
  htdigital: HT_DIGITAL_PARTNER,
  "ht-digital": HT_DIGITAL_PARTNER,
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
