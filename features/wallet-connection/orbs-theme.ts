import type { darkTheme } from "@rainbow-me/rainbowkit";
import type { PartnerStyles } from "@/lib/partners/types";

/** Keep RainbowKit's nested wallet/QR screens on the same Orbs website palette. */
export function getOrbsWalletColors({ colors }: PartnerStyles): ReturnType<typeof darkTheme>["colors"] {
  return {
    accentColor: colors.primary,
    accentColorForeground: colors.primaryForeground,
    actionButtonBorder: colors.border,
    actionButtonBorderMobile: colors.border,
    actionButtonSecondaryBackground: colors.secondary,
    closeButton: colors.mutedForeground,
    closeButtonBackground: colors.accent,
    connectButtonBackground: colors.primary,
    connectButtonBackgroundError: colors.destructive,
    connectButtonInnerBackground: colors.secondary,
    connectButtonText: colors.primaryForeground,
    connectButtonTextError: colors.background,
    connectionIndicator: colors.chart2,
    downloadBottomCardBackground: colors.secondary,
    downloadTopCardBackground: colors.card,
    error: colors.destructive,
    generalBorder: colors.border,
    generalBorderDim: colors.border,
    menuItemBackground: colors.accent,
    modalBackdrop: "rgb(18 18 20 / 50%)",
    modalBackground: colors.popover,
    modalBorder: colors.border,
    modalText: colors.foreground,
    modalTextDim: colors.mutedForeground,
    modalTextSecondary: colors.mutedForeground,
    profileAction: colors.secondary,
    profileActionHover: colors.accent,
    profileForeground: colors.card,
    selectedOptionBorder: colors.primary,
    standby: colors.chart4,
  };
}
