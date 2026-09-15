const DEFAULT_SPOT_DOCS_URL = "https://spot-docs.orbs.com";

export const SPOT_DOCS_URL = (
  process.env.NEXT_PUBLIC_SPOT_DOCS_URL ?? DEFAULT_SPOT_DOCS_URL
).replace(/\/$/, "");

export function getSpotDocsHref(pathname: string, section?: string): string {
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${SPOT_DOCS_URL}${normalizedPath}${section ? `#${section}` : ""}`;
}
