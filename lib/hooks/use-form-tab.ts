import { StringParam, useQueryParam } from "use-query-params";
import { FORM_TABS, SPOT_TABS } from "../consts";
import { FormTab } from "../types";
import { useCallback, useMemo } from "react";

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

export const useSelectedFormTab = () => {
  const [tab, setTab] = useQueryParam("tab", StringParam);
  const selectedValue = tabParamToFormTab[tab ?? ""] ?? FormTab.SWAP;

  const selectedTab =
    FORM_TABS.find((formTab) => formTab.value === selectedValue) ??
    FORM_TABS[0];

  const setSelectedTab = useCallback(
    (nextTab: FormTab) => {
      setTab(formTabToTabParam[nextTab] ?? undefined);
    },
    [setTab]
  );

  return useMemo(
    () => ({
      selectedTab,
      setSelectedTab,
    }),
    [selectedTab, setSelectedTab]
  );
};

export const useIsSpotTab = () => {
  const { selectedTab } = useSelectedFormTab();
  return SPOT_TABS.includes(selectedTab.value as (typeof SPOT_TABS)[number]);
};
