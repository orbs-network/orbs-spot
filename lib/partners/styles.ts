import type { CSSProperties } from "react";
import type { PartnerStyles } from "./config";

type PartnerCssVariables = CSSProperties & Record<`--${string}`, string>;

const transparentMix = (color: string, amount: number) =>
  `color-mix(in srgb, ${color} ${amount}%, transparent)`;

export function getPartnerStyleVariables(
  styles: PartnerStyles,
): PartnerCssVariables {
  const { colors } = styles;
  const selectedTabBackground = styles.selectedTabBackground ?? colors.primary;
  const settingsTriggerBackground =
    styles.settingsTriggerBackground ?? transparentMix(colors.primary, 14);
  const settingsTriggerHoverBackground =
    styles.settingsTriggerHoverBackground ?? transparentMix(colors.primary, 16);

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
    "--selected-tab-background": selectedTabBackground,
    "--settings-trigger-background": settingsTriggerBackground,
    "--settings-trigger-hover-background": settingsTriggerHoverBackground,
    "--settings-trigger-foreground":
      styles.settingsTriggerForeground ?? colors.primary,
  };
}
