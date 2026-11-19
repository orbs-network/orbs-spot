export const DEFAULT_SPOT_API_URL = "https://order-sink-v2.orbs.network";
export const DEV_SPOT_API_URL = "https://order-sink-dev.orbs.network";
export const PROD_V1_SPOT_API_URL = "https://order-sink.orbs.network";

const apiUrls = new Map([
  ["dev", DEV_SPOT_API_URL],
  ["v1", PROD_V1_SPOT_API_URL],
  ["v2", DEFAULT_SPOT_API_URL],
]);

/** Select a trusted service from the page's API query parameter. */
export function getSpotApiUrl(params: { get(name: string): string | null }): string {
  return apiUrls.get(params.get("api") ?? "") ?? DEFAULT_SPOT_API_URL;
}

/** An explicit API selection enables the same partner-testing features as debug mode. */
export function isSpotDebugMode(params: { get(name: string): string | null }): boolean {
  return params.get("debug") === "true" || apiUrls.has(params.get("api") ?? "");
}
