const UNKNOWN_PARTNER_ID = "unknown";
const DEX_PARTNER_ID_COMMENT =
  '// Use your DEX partner ID if Orbs provided one; otherwise use "unknown".';
const LIQUIDITY_HUB_PARTNER_ID_COMMENT =
  '// Use the partner name provided by Orbs; otherwise use "unknown".';

export function getExamplePartnerId(value: unknown): string {
  return typeof value === "string" && value.trim()
    ? value
    : UNKNOWN_PARTNER_ID;
}

export function formatPartnerDeclaration(partner: string): string {
  return `${DEX_PARTNER_ID_COMMENT}\nconst partner = ${JSON.stringify(partner)};`;
}

export function getLiquidityHubExamplePartnerId(value: unknown): string {
  return typeof value === "string" && value.trim()
    ? value
    : UNKNOWN_PARTNER_ID;
}

export function formatLiquidityHubPartnerDeclaration(
  partner: string,
): string {
  return `${LIQUIDITY_HUB_PARTNER_ID_COMMENT}\nconst partner = ${JSON.stringify(partner)};`;
}
