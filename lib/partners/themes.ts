import type { PartnerStyles } from "./types";
import { getPartnerStyleVariables } from "./styles";

export function getDefaultTheme(styles: PartnerStyles): "light" | "dark" {
  const hex = styles.colors.background.replace("#", "");
  const [red, green, blue] = [0, 2, 4].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
  return red * 0.2126 + green * 0.7152 + blue * 0.0722 > 128 ? "light" : "dark";
}

export function getThemeStyles(styles: PartnerStyles, theme: "light" | "dark"): PartnerStyles {
  if (theme === getDefaultTheme(styles)) return styles;
  const light = theme === "light";
  const foreground = light ? "#20212a" : "#fafafa";
  const card = light ? "#ffffff" : "#171717";
  const secondary = light ? "#eef0f4" : "#262626";
  const border = light ? "#d9dde5" : "rgba(255, 255, 255, 0.12)";
  return {
    radius: styles.radius,
    fontFamily: styles.fontFamily,
    controlRadius: styles.controlRadius,
    formContainerRadius: styles.formContainerRadius,
    formPanelRadius: styles.formPanelRadius,
    submitButtonRadius: styles.submitButtonRadius,
    tabListRadius: styles.tabListRadius,
    selectedTabRadius: styles.selectedTabRadius,
    colors: {
      ...styles.colors,
      background: light ? "#f6f7fa" : "#0a0a0a",
      foreground,
      card,
      cardForeground: foreground,
      popover: card,
      popoverForeground: foreground,
      primary: light ? `color-mix(in srgb, ${styles.colors.primary} 70%, black)` : styles.colors.primary,
      secondary,
      secondaryForeground: foreground,
      muted: secondary,
      mutedForeground: light ? "#616775" : "#a1a1a1",
      accent: secondary,
      accentForeground: foreground,
      destructive: light ? "#c92d3b" : "#ff6568",
      border,
      input: border,
      ring: light ? "#616775" : "#a1a1a1",
      sidebar: card,
      sidebarForeground: foreground,
      sidebarAccent: secondary,
      sidebarAccentForeground: foreground,
      sidebarBorder: border,
    },
  };
}

export function getPartnerThemeCss(styles: PartnerStyles): string {
  return (["light", "dark"] as const).map((theme) => {
    const variables = getPartnerStyleVariables(getThemeStyles(styles, theme));
    return `html.${theme}{color-scheme:${theme};${Object.entries(variables).map(([key, value]) => `${key}:${value}`).join(";")}}`;
  }).join("\n");
}
