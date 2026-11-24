import { orbsPartner } from "./orbs";
import type { PartnerConfig, PartnerStyles } from "./types";

type ThemeOverride = Partial<Omit<PartnerStyles, "colors" | "themeOverrides">> & {
  colors?: Partial<PartnerStyles["colors"]>;
};

// Theme values are rendered into a style element. Restrict them to CSS values,
// not declarations or markup, and reject unknown keys to catch configuration typos.
function readTheme(value: string | undefined, name: string): ThemeOverride {
  if (!value) return {};
  let parsed: unknown;
  try { parsed = JSON.parse(value); } catch { throw new Error(`${name} must be a JSON object`); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error(`${name} must be a JSON object`);
  const input = parsed as Record<string, unknown>;
  const validStyle = new Set([...Object.keys(orbsPartner.styles), "formContainerBorder", "tabListBorder", "selectedTabShadow"]);
  const validColors = new Set(Object.keys(orbsPartner.styles.colors));
  const check = (entry: unknown, key: string) => {
    if (typeof entry !== "string" || !entry.trim() || /[;{}<>]/.test(entry)) throw new Error(`${name}: invalid CSS value for ${key}`);
  };
  for (const [key, entry] of Object.entries(input)) {
    if (key === "colors") {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new Error(`${name}: colors must be an object`);
      for (const [color, colorValue] of Object.entries(entry)) {
        if (!validColors.has(color)) throw new Error(`${name}: unknown color ${color}`);
        check(colorValue, color);
      }
    } else {
      if (!validStyle.has(key) || key === "themeOverrides") throw new Error(`${name}: unknown style ${key}`);
      check(entry, key);
    }
  }
  return input as ThemeOverride;
}

export function getAppId(): string {
  return process.env.APP_ID || (process.env.APP_NAME ? "whitelabel" : orbsPartner.id);
}

export function getAppConfig(): PartnerConfig {
  const light = readTheme(process.env.APP_THEME_LIGHT, "APP_THEME_LIGHT");
  const dark = readTheme(process.env.APP_THEME_DARK, "APP_THEME_DARK");
  const defaultTheme = process.env.APP_DEFAULT_THEME || "light";
  if (defaultTheme !== "light" && defaultTheme !== "dark") throw new Error("APP_DEFAULT_THEME must be light or dark");
  const base = orbsPartner.styles;
  const darkBase = base.themeOverrides?.dark;
  const brandName = process.env.APP_NAME || orbsPartner.brand.name;
  const isCustomBrand = !!process.env.APP_NAME || !!process.env.APP_ID;
  return {
    ...orbsPartner,
    id: getAppId(),
    brand: {
      ...orbsPartner.brand,
      name: brandName,
      tradingLabel: process.env.APP_TRADING_LABEL || (isCustomBrand ? "Trade" : "dSPOT"),
      navWordmark: process.env.APP_WORDMARK || (isCustomBrand ? "" : orbsPartner.brand.navWordmark),
      logoSrc: process.env.APP_LOGO_URL || (isCustomBrand ? undefined : orbsPartner.brand.logoSrc),
      iconSrc: process.env.APP_ICON_URL || (isCustomBrand ? "/brand-icon.svg" : orbsPartner.brand.iconSrc),
      appleIconSrc: process.env.APP_APPLE_ICON_URL || (isCustomBrand ? "/brand-icon.svg" : orbsPartner.brand.appleIconSrc),
      navLogoClassName: isCustomBrand ? undefined : orbsPartner.brand.navLogoClassName,
      logoAlt: process.env.APP_LOGO_ALT || brandName,
      metadata: {
        title: process.env.APP_TITLE || (isCustomBrand ? brandName : orbsPartner.brand.metadata.title),
        description: process.env.APP_DESCRIPTION || (isCustomBrand ? `Trade tokens on ${brandName}.` : orbsPartner.brand.metadata.description),
        url: process.env.NEXT_PUBLIC_APP_URL || (isCustomBrand ? undefined : orbsPartner.brand.metadata.url),
      },
    },
    styles: {
      ...base,
      themeOverrides: {
        light: { ...light, colors: { ...light.colors } },
        dark: { ...darkBase, ...dark, colors: { ...darkBase?.colors, ...dark.colors } },
      },
    },
    defaultTheme,
  };
}
