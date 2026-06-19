import type { CSSProperties } from "react";
import type { PartnerStyles } from "./config";

type PartnerCssVariables = CSSProperties & Record<`--${string}`, string>;

const transparentMix = (color: string, amount: number) =>
  `color-mix(in srgb, ${color} ${amount}%, transparent)`;

export function getPartnerStyleVariables(
  styles: PartnerStyles,
): PartnerCssVariables {
  const { colors } = styles;

  return {
    "--radius": styles.radius,
    "--font-inter": styles.fontFamily,
    "--background": colors.background,
    "--foreground": colors.foreground,
    "--card": colors.card,
    "--card-foreground": colors.cardForeground,
    "--popover": colors.popover,
    "--popover-foreground": colors.popoverForeground,
    "--primary": colors.primary,
    "--primary-foreground": colors.primaryForeground,
    "--secondary": colors.secondary,
    "--secondary-foreground": colors.secondaryForeground,
    "--muted": colors.muted,
    "--muted-foreground": colors.mutedForeground,
    "--accent": colors.accent,
    "--accent-foreground": colors.accentForeground,
    "--destructive": colors.destructive,
    "--border": colors.border,
    "--input": colors.input,
    "--ring": colors.ring,
    "--chart-1": colors.chart1,
    "--chart-2": colors.chart2,
    "--chart-3": colors.chart3,
    "--chart-4": colors.chart4,
    "--chart-5": colors.chart5,
    "--sidebar": colors.sidebar,
    "--sidebar-foreground": colors.sidebarForeground,
    "--sidebar-primary": colors.sidebarPrimary,
    "--sidebar-primary-foreground": colors.sidebarPrimaryForeground,
    "--sidebar-accent": colors.sidebarAccent,
    "--sidebar-accent-foreground": colors.sidebarAccentForeground,
    "--sidebar-border": colors.sidebarBorder,
    "--sidebar-ring": colors.sidebarRing,
    "--app-shell-background": colors.background,
    "--nav-pill-background": transparentMix(colors.secondary, 86),
    "--nav-pill-hover-background": transparentMix(colors.accent, 48),
    "--nav-pill-shadow":
      "inset 0 1px 0 rgba(255,255,255,0.04), 0 10px 26px rgba(0,0,0,0.24)",
    "--wallet-avatar-shadow": `0 0 18px ${transparentMix(colors.primary, 42)}`,
    "--button-primary-shadow": `0 0 24px ${transparentMix(colors.primary, 24)}`,
    "--tab-active-shadow": `0 12px 34px ${transparentMix(colors.primary, 34)}`,
    "--form-card-shadow": "0 18px 80px rgba(0,0,0,0.38)",
  };
}
