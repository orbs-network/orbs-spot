import type { PartnerStyles } from "./types";

type PaletteOverride = Partial<Omit<PartnerStyles, "colors" | "themeOverrides">> & {
  colors: Partial<PartnerStyles["colors"]>;
};

/** Derive surfaces from one six-digit brand color, retaining readable text roles. */
export function createBrandPalette(primary: string): Record<"light" | "dark", PaletteOverride> {
  if (!/^#[\da-f]{6}$/i.test(primary)) throw new Error("APP_PRIMARY_COLOR must be a six-digit hex color");
  const rgb = [1, 3, 5].map(index => parseInt(primary.slice(index, index + 2), 16));
  const luminance = rgb.map(value => {
    const channel = value / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
  const primaryForeground = (luminance + 0.05) / 0.05 >= 1.05 / (luminance + 0.05) ? "#000000" : "#ffffff";
  const mix = (base: string, ratio: number) => {
    const target = [1, 3, 5].map(index => parseInt(base.slice(index, index + 2), 16));
    return `#${target.map((channel, index) => Math.round(channel * (1 - ratio) + rgb[index] * ratio).toString(16).padStart(2, "0")).join("")}`;
  };
  const mode = (dark: boolean): PaletteOverride => {
    const background = dark ? mix("#101116", 0.04) : mix("#f8f9fc", 0.025);
    const card = dark ? mix("#1b1d24", 0.06) : "#ffffff";
    const secondary = dark ? mix("#292c35", 0.07) : mix("#eef0f4", 0.035);
    const foreground = dark ? "#f8f8fa" : "#171921";
    const mutedForeground = dark ? "#c1c3ca" : "#575d6b";
    const border = dark ? mix("#454853", 0.08) : mix("#d4d7df", 0.06);
    return {
      navBackground: background,
      formContainerBackground: card, formContainerBorder: border,
      formPanelBackground: secondary, formPanelBorder: border,
      tabListBackground: secondary, tabListBorder: border,
      selectedTabBackground: primary, selectedTabForeground: primaryForeground,
      settingsTriggerBackground: secondary, settingsTriggerHoverBackground: border,
      settingsTriggerForeground: foreground,
      colors: {
        background, foreground, card, cardForeground: foreground,
        popover: card, popoverForeground: foreground,
        primary, primaryForeground, secondary, secondaryForeground: foreground,
        muted: secondary, mutedForeground, accent: secondary, accentForeground: foreground,
        destructive: dark ? "#ff9b9e" : "#b42332", border, input: border, ring: primary,
        chart1: primary, chart2: dark ? "#5ce0b0" : "#087e62", chart3: dark ? "#ffcc80" : "#a96600",
        chart4: dark ? "#c5a7ff" : "#7650b8", chart5: dark ? "#ff9b9e" : "#b42332",
        sidebar: card, sidebarForeground: foreground, sidebarPrimary: primary,
        sidebarPrimaryForeground: primaryForeground, sidebarAccent: secondary,
        sidebarAccentForeground: foreground, sidebarBorder: border, sidebarRing: primary,
      },
    };
  };
  return { light: mode(false), dark: mode(true) };
}
