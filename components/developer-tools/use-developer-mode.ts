import { useCallback, useMemo } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { pushUrlState } from "@/lib/url-state";

export const DEVELOPER_MODE_QUERY_PARAM = "devMode";

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
