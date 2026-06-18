import { StringParam, useQueryParam } from "use-query-params";
import { FORM_TABS, SPOT_TABS } from "../consts";
import { FormTab } from "../types";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useFormTabStore } from "./store";

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
  const urlValue = tabParamToFormTab[tab ?? ""] ?? FormTab.SWAP;
  const queryUpdateTimerRef = useRef<number | null>(null);
  const pendingTab = useFormTabStore((state) => state.pendingTab);
  const selectedValue = useFormTabStore((state) => state.selectedTab);
  const clearPendingTab = useFormTabStore((state) => state.clearPendingTab);
  const setPendingTab = useFormTabStore((state) => state.setPendingTab);
  const setSelectedTabValue = useFormTabStore((state) => state.setSelectedTab);

  useEffect(() => {
    if (pendingTab) {
      if (urlValue === pendingTab) {
        clearPendingTab();
      }
      return;
    }

    if (selectedValue !== urlValue) {
      setSelectedTabValue(urlValue);
    }
  }, [clearPendingTab, pendingTab, selectedValue, setSelectedTabValue, urlValue]);

  useEffect(() => {
    return () => {
      if (queryUpdateTimerRef.current) {
        window.clearTimeout(queryUpdateTimerRef.current);
      }
    };
  }, []);

  const selectedTab =
    FORM_TABS.find((formTab) => formTab.value === selectedValue) ??
    FORM_TABS[0];

  const setSelectedTab = useCallback(
    (nextTab: FormTab) => {
      setSelectedTabValue(nextTab);
      setPendingTab(nextTab);

      if (queryUpdateTimerRef.current) {
        window.clearTimeout(queryUpdateTimerRef.current);
      }

      queryUpdateTimerRef.current = window.setTimeout(() => {
        setTab(formTabToTabParam[nextTab] ?? undefined);
        queryUpdateTimerRef.current = null;
      }, 320);
    },
    [setPendingTab, setSelectedTabValue, setTab]
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
