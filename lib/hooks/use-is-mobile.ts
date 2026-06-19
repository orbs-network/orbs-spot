"use client";

import { useCallback, useSyncExternalStore } from "react";

const MOBILE_QUERY = "(max-width: 639px)";

const getServerSnapshot = () => false;

export function useIsMobile(query = MOBILE_QUERY) {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const mediaQuery = window.matchMedia(query);

      mediaQuery.addEventListener("change", onStoreChange);

      return () => {
        mediaQuery.removeEventListener("change", onStoreChange);
      };
    },
    [query],
  );

  const getSnapshot = useCallback(() => {
    const mediaQuery = window.matchMedia(query);
    return mediaQuery.matches;
  }, [query]);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
