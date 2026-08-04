import type { PartnerConfig } from "./types";

export const crymboPartner: PartnerConfig = {
  id: "crymbo",
  brand: {
    name: "CRYMBO",
    logoSrc: "/crymbo-logo.svg",
    navLogoClassName: "h-6 max-w-[96px] sm:h-8 sm:max-w-[172px]",
    iconSrc: "/crymbo-icon.png",
    appleIconSrc: "/crymbo-icon.png",
    logoAlt: "CRYMBO",
    externalUrl: "https://crymbo.com/platform/",
    metadata: {
      title:
        "CRYMBO Platform | Full Stack Digital Asset Infrastructure | Single API",
      description:
        "350+ production-ready features across payments, wallets, compliance, and cards. Oracle Identity Verification and NodeMonitor active on every transaction. White-label. Live in weeks.",
      url: "https://crymbo.com/platform/",
    },
  },
  styles: {
    radius: "0.625rem",
    fontFamily:
      'Inter, "Plus Jakarta Sans", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    selectedTabBackground:
      "linear-gradient(135deg, #2563eb 0%, #5888f0 100%)",
    settingsTriggerBackground: "rgba(37, 99, 235, 0.08)",
    settingsTriggerHoverBackground: "rgba(37, 99, 235, 0.12)",
    settingsTriggerForeground: "#2563eb",
    colors: {
      background: "#f5f7fa",
      foreground: "#0a1520",
      card: "#ffffff",
      cardForeground: "#0a1520",
      popover: "#ffffff",
      popoverForeground: "#0a1520",
      primary: "#2563eb",
      primaryForeground: "#ffffff",
      secondary: "#edf4f8",
      secondaryForeground: "#0a1520",
      muted: "#f5f7fa",
      mutedForeground: "#3d6880",
      accent: "#e0eff5",
      accentForeground: "#0a1520",
      destructive: "#e40014",
      border: "rgba(60, 130, 160, 0.12)",
      input: "rgba(60, 130, 160, 0.18)",
      ring: "#2563eb",
      chart1: "#2563eb",
      chart2: "#5888f0",
      chart3: "#4a8eae",
      chart4: "#7868cc",
      chart5: "#d98e38",
      sidebar: "#ffffff",
      sidebarForeground: "#0a1520",
      sidebarPrimary: "#2563eb",
      sidebarPrimaryForeground: "#ffffff",
      sidebarAccent: "#e0eff5",
      sidebarAccentForeground: "#0a1520",
      sidebarBorder: "rgba(60, 130, 160, 0.12)",
      sidebarRing: "#2563eb",
    },
  },
};
