import type { PartnerConfig } from "./types";

export const htDigitalPartner: PartnerConfig = {
  id: "ht-digital",
  brand: {
    name: "HT Digital",
    logoSrc: "/ht-digital-logo-mark.svg",
    iconSrc: "/ht-digital-logo-mark.svg",
    appleIconSrc: "/ht-digital-logo-mark.svg",
    logoAlt: "HT Digital",
    externalUrl: "https://www.ht.digital/",
    metadata: {
      title: "HT Digital",
      description:
        "HT Digital is the leading onchain provider of financial audit, accounting, tax, advisory and operational services.",
      url: "https://www.ht.digital/",
    },
  },
  styles: {
    radius: "0.75rem",
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    selectedTabBackground:
      "radial-gradient(circle, #f3f7dc 0%, #d9e69e 100%)",
    settingsTriggerBackground:
      "radial-gradient(circle, #f3f7dc 0%, #d9e69e 100%)",
    settingsTriggerHoverBackground:
      "radial-gradient(circle, #f3f7dc 0%, #d9e69e 100%)",
    settingsTriggerForeground: "#161540",
    colors: {
      background: "#fbfcff",
      foreground: "#161540",
      card: "#ffffff",
      cardForeground: "#161540",
      popover: "#ffffff",
      popoverForeground: "#161540",
      primary: "#d4f157",
      primaryForeground: "#161540",
      secondary: "#f4f6fa",
      secondaryForeground: "#161540",
      muted: "#f0f3f8",
      mutedForeground: "#66708c",
      accent: "#edf4ff",
      accentForeground: "#161540",
      destructive: "#c93d4f",
      border: "rgba(22, 21, 64, 0.12)",
      input: "rgba(22, 21, 64, 0.16)",
      ring: "#d4f157",
      chart1: "#161540",
      chart2: "#d4f157",
      chart3: "#bdddff",
      chart4: "#5d6aa5",
      chart5: "#7fa56a",
      sidebar: "#ffffff",
      sidebarForeground: "#161540",
      sidebarPrimary: "#d4f157",
      sidebarPrimaryForeground: "#161540",
      sidebarAccent: "#f4f6fa",
      sidebarAccentForeground: "#161540",
      sidebarBorder: "rgba(22, 21, 64, 0.12)",
      sidebarRing: "#d4f157",
    },
  },
};
