import { usePathname } from "next/navigation";
import { isDeveloperPlaygroundPath } from "@/lib/developer-routes";


export const DEVELOPER_MODE_QUERY_PARAM = "debug";

export const preserveDeveloperModeInHref = (
  href: string,
  isDeveloperMode: boolean,
): string => {
  if (!isDeveloperMode) return href;

  const hashIndex = href.indexOf("#");
  const pathAndQuery = hashIndex === -1 ? href : href.slice(0, hashIndex);
  const hash = hashIndex === -1 ? "" : href.slice(hashIndex);
  const queryIndex = pathAndQuery.indexOf("?");
  const pathname =
    queryIndex === -1 ? pathAndQuery : pathAndQuery.slice(0, queryIndex);
  const params = new URLSearchParams(
    queryIndex === -1 ? "" : pathAndQuery.slice(queryIndex + 1),
  );

  params.set(DEVELOPER_MODE_QUERY_PARAM, "true");
  return `${pathname}?${params.toString()}${hash}`;
};

export const useDeveloperMode = () => {
  const pathname = usePathname();
  const isDeveloperPlayground = isDeveloperPlaygroundPath(pathname);
  return { isDeveloperMode: isDeveloperPlayground, isDeveloperPlayground };
};

/** Read-only preview identity. Never used for wallet writes. */
export { QUOTE_PREVIEW_ACCOUNT as DEVELOPER_PREVIEW_ACCOUNT } from "@/lib/swap/quote-preview";
