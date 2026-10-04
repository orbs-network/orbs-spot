import { useCallback } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { updateUrlSearchParams } from "@/lib/url-state";
import { getActiveClientPartnerConfig } from "@/lib/partners/client";
import { hasDeveloperTools } from "@/lib/partners/config";

export const DEVELOPER_MODE_QUERY_PARAM = "devMode";

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
  const searchParams = useSearchParams();
  const isDeveloperToolsAvailable = hasDeveloperTools(getActiveClientPartnerConfig());
  const isDeveloperMode =
    isDeveloperToolsAvailable && searchParams.get(DEVELOPER_MODE_QUERY_PARAM) === "true";

  const setIsDeveloperMode = useCallback(
    (enabled: boolean) => {
      updateUrlSearchParams(pathname, searchParams, (nextParams) => {
        if (enabled && isDeveloperToolsAvailable) {
          nextParams.set(DEVELOPER_MODE_QUERY_PARAM, "true");
        } else {
          nextParams.delete(DEVELOPER_MODE_QUERY_PARAM);
        }
      });
    },
    [pathname, searchParams, isDeveloperToolsAvailable],
  );

  return { isDeveloperMode, setIsDeveloperMode, isDeveloperToolsAvailable };
};

/** Read-only preview identity. Never used for wallet writes. */
export const DEVELOPER_PREVIEW_ACCOUNT = "0x5555555555555555555555555555555555555555" as const;
