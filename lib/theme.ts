"use client";

import { useSyncExternalStore } from "react";

export type Theme = "light" | "dark";
const STORAGE_KEY = "orbs-color-theme";

function getTheme(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function applyTheme(theme: Theme) {
  // Apply theme colors together, without triggering hover/focus transitions.
  const transitionBlock = document.createElement("style");
  transitionBlock.dataset.themeTransitionBlock = "";
  transitionBlock.textContent = "*, *::before, *::after { transition: none !important; }";
  document.head.appendChild(transitionBlock);
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.classList.toggle("light", theme === "light");
  // Commit the new colors while transitions are disabled, then restore normal
  // interactions after the theme and its React consumers have painted.
  void document.documentElement.offsetHeight;
  requestAnimationFrame(() => requestAnimationFrame(() => transitionBlock.remove()));
}

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY && (event.newValue === "light" || event.newValue === "dark")) {
      applyTheme(event.newValue);
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    observer.disconnect();
    window.removeEventListener("storage", onStorage);
  };
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getTheme, () => "dark" as const);
  return { theme, setTheme };
}

function setTheme(theme: Theme) {
  applyTheme(theme);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // The toggle still works when storage is unavailable.
  }
}
