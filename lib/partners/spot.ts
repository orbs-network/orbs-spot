import { Partners } from "@orbs-network/spot-ui";

export function isSpotPartnerIdentifier(value: unknown): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(value);
}

export function getActiveSpotPartner() {
  const name = process.env.NEXT_PARTNER || Partners.External;
  if (!isSpotPartnerIdentifier(name)) {
    throw new Error("NEXT_PARTNER must be a valid Spot partner identifier");
  }
  // The SDK accepts configured partner identifiers even before its enum is updated.
  return name as Partners;
}
