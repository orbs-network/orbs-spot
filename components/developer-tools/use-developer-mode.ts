import { useCallback, useMemo } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { pushUrlState } from "@/lib/url-state";

export const DEVELOPER_MODE_QUERY_PARAM = "devMode";

export const preserveDeveloperModeInHref = (
  href: string,
  isDeveloperMode: boolean,
) => {
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
  const searchParams = useSearchParams();
  const isDeveloperMode =
    searchParams.get(DEVELOPER_MODE_QUERY_PARAM) === "true";

  const setIsDeveloperMode = useCallback(
    (enabled: boolean) => {
      const nextParams = new URLSearchParams(searchParams.toString());

      if (enabled) {
        nextParams.set(DEVELOPER_MODE_QUERY_PARAM, "true");
      } else {
        nextParams.delete(DEVELOPER_MODE_QUERY_PARAM);
      }

      const queryString = nextParams.toString();
      const hash =
        typeof window === "undefined" ? "" : window.location.hash;
      const href = `${pathname}${queryString ? `?${queryString}` : ""}${hash}`;

      pushUrlState(href);
    },
    [pathname, searchParams],
  );

  return useMemo(
    () => ({ isDeveloperMode, setIsDeveloperMode }),
    [isDeveloperMode, setIsDeveloperMode],
  );
};
