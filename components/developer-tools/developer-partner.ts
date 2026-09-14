const EXTERNAL_PARTNER_ID = "external";
const DEX_PARTNER_ID_COMMENT =
  '// Use your DEX partner ID if Orbs provided one; otherwise use "external".';
const LIQUIDITY_HUB_PARTNER_ID_COMMENT =
  '// Use the partner name provided by Orbs; otherwise use "external".';

export function getExamplePartnerId(value: unknown): string {
  return typeof value === "string" && value.trim()
    ? value
    : EXTERNAL_PARTNER_ID;
}

export function formatPartnerDeclaration(partner: string): string {
  return `${DEX_PARTNER_ID_COMMENT}\nconst partner = ${JSON.stringify(partner)};`;
}

export function getLiquidityHubExamplePartnerId(value: unknown): string {
  return typeof value === "string" && value.trim()
    ? value
    : EXTERNAL_PARTNER_ID;
}

export function formatLiquidityHubPartnerDeclaration(
  partner: string,
): string {
  return `${LIQUIDITY_HUB_PARTNER_ID_COMMENT}\nconst partner = ${JSON.stringify(partner)};`;
}
