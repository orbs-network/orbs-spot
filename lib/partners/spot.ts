import { Partners } from "@orbs-network/spot-ui";

export function getActiveSpotPartner() {
  const name = process.env.NEXT_PUBLIC_SPOT_PARTNER || Partners.External;
  if (!Object.values(Partners).includes(name as Partners)) {
    throw new Error(`Unknown NEXT_PUBLIC_SPOT_PARTNER: ${name}`);
  }
  return name as Partners;
}
