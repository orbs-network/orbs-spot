import { FORM_TABS, SPOT_TABS } from "../consts";
import { FormTab } from "../types";
import { useCallback } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { updateUrlSearchParams } from "../url-state";

const tabParamToFormTab: Record<string, FormTab> = {
  swap: FormTab.SWAP,
  twap: FormTab.TWAP,
  limit: FormTab.LIMIT,
  "stop-loss": FormTab.STOP_LOSS,
  "take-profit": FormTab.TAKE_PROFIT,
};

const formTabToTabParam: Record<FormTab, string | undefined> = {
  [FormTab.SWAP]: undefined,
  [FormTab.TWAP]: "twap",
  [FormTab.LIMIT]: "limit",
  [FormTab.STOP_LOSS]: "stop-loss",
  [FormTab.TAKE_PROFIT]: "take-profit",
};

export const preserveFormTabInHref = (
  href: string,
  formTab: FormTab,
): string => {
  const hashIndex = href.indexOf("#");
  const pathAndQuery = hashIndex === -1 ? href : href.slice(0, hashIndex);
  const hash = hashIndex === -1 ? "" : href.slice(hashIndex);
  const queryIndex = pathAndQuery.indexOf("?");
  const pathname =
    queryIndex === -1 ? pathAndQuery : pathAndQuery.slice(0, queryIndex);
  const params = new URLSearchParams(
    queryIndex === -1 ? "" : pathAndQuery.slice(queryIndex + 1),
  );
  const tabParam = formTabToTabParam[formTab];

  if (tabParam) {
    params.set("tab", tabParam);
  } else {
    params.delete("tab");
  }

  const queryString = params.toString();
  return `${pathname}${queryString ? `?${queryString}` : ""}${hash}`;
};

export const useSelectedFormTab = () => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab");
  const selectedValue = tabParamToFormTab[tab ?? ""] ?? FormTab.SWAP;

  const selectedTab =
    FORM_TABS.find((formTab) => formTab.value === selectedValue) ??
    FORM_TABS[0];

  const setSelectedTab = useCallback(
    (nextTab: FormTab) => {
      updateUrlSearchParams(pathname, searchParams, (nextParams) => {
        const tabParam = formTabToTabParam[nextTab];

        if (tabParam) {
          nextParams.set("tab", tabParam);
        } else {
          nextParams.delete("tab");
        }
      });
    },
    [pathname, searchParams],
  );

  return { selectedTab, setSelectedTab };
};

export const useIsSpotTab = () => {
  const { selectedTab } = useSelectedFormTab();
  return SPOT_TABS.includes(selectedTab.value as (typeof SPOT_TABS)[number]);
};

export const useIsSwapTab = () => {
  const { selectedTab } = useSelectedFormTab();
  return selectedTab.value === FormTab.SWAP;
};
