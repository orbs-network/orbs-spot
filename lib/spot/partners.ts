import { Partners } from "@orbs-network/spot-ui";

export const SPOT_PARTNERS_CONFIG_URL =
  "https://raw.githubusercontent.com/orbs-network/spot/master/config.json";

export type SpotPartner = { chainId: number; name: Partners };

export function getPartnerChains<T extends { id: number }>(
  chains: readonly T[],
  partners: readonly SpotPartner[],
  partner: Partners,
): T[] {
  const supported = new Set(partners.filter(item => item.name === partner).map(item => item.chainId));
  return chains.filter(chain => supported.has(chain.id));
}

const partnerNames: ReadonlySet<string> = new Set(Object.values(Partners));
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export function parseSpotPartner(value: string | null, fallback: Partners): Partners {
  const name = value?.split("_")[0];
  return name && partnerNames.has(name) ? name as Partners : fallback;
}

/** Include global partner defaults as well as network-specific integrations. */
export function parseSpotPartners(value: unknown): SpotPartner[] {
  if (!isRecord(value) || !isRecord(value["*"])) {
    throw new Error("Invalid Spot partner configuration");
  }
  const dexFor = (entry: unknown): Record<string, unknown> => {
    if (!isRecord(entry) || (entry.dex !== undefined &&
      (!isRecord(entry.dex) || !Object.values(entry.dex).every(isRecord)))) {
      throw new Error("Invalid Spot partner configuration");
    }
    return isRecord(entry.dex) ? entry.dex : {};
  };
  const globalDex = dexFor(value["*"]);
  return Object.entries(value).flatMap(([key, entry]) => {
    const dex = dexFor(entry);
    const chainId = Number(key);
    if (!Number.isSafeInteger(chainId) || chainId <= 0) return [];
    return Object.keys({ ...globalDex, ...dex })
      .filter(name => partnerNames.has(name))
      .map(name => ({ chainId, name: name as Partners }));
  }).sort((a, b) => a.name.localeCompare(b.name) || a.chainId - b.chainId);
}

export async function fetchSpotPartners(signal: AbortSignal): Promise<SpotPartner[]> {
  const response = await fetch(SPOT_PARTNERS_CONFIG_URL, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
  });
  if (!response.ok) throw new Error(`Could not load Spot partners (${response.status})`);
  return parseSpotPartners(await response.json());
}
