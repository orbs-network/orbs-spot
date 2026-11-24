---
name: spot-theme
description: Apply or revise a white-label brand and light/dark theme in the Spot app from a name, logo, color, or visual brief. Use for partner branding and appearance changes in this repository.
---

# Brand the Spot app

Read the white-label section of `README.md`, `.env.example`, and `lib/partners/types.ts`. Reuse the supplied name, assets, colors, and mode; preserve unrelated existing settings on revisions. If a detail is unspecified, choose a sensible reversible default and say what was inferred. Offer text-only branding if no logo is supplied; do not invent a logo.

## Apply identity and palette

Put partner assets in `public/` and configure the ignored `.env.local`, preserving unrelated entries. Use `APP_ID`, `APP_NAME`, `APP_WORDMARK`, `APP_LOGO_URL`, `APP_LOGO_ALT`, `APP_ICON_URL`, `APP_APPLE_ICON_URL`, `APP_TITLE`, `APP_DESCRIPTION`, and `APP_TRADING_LABEL` as appropriate. Set a stable non-`orbs` `APP_ID` for custom branding: it also controls Orbs-specific CSS selectors. With a custom brand and no image, navigation uses text and a generic icon; provide actual partner icons when available. Check image proportions and avoid duplicating a wordmark already in the logo.

`APP_DEFAULT_THEME` is `light` or `dark`. Set `APP_PRIMARY_COLOR` to a six-digit brand hex to generate both palettes; use the JSON overrides below only for requested refinements. `APP_THEME_LIGHT` and `APP_THEME_DARK` are single-line JSON objects using `PartnerStyles` properties, including nested `colors`, not CSS variable names. Values are CSS strings; the parser rejects unknown keys, empty values, semicolons, braces, and markup. Quote the JSON in the env file, especially hex values containing `#`. See `lib/partners/config.ts`, `lib/partners/themes.ts`, and `lib/partners/styles.ts` for merging and the mapped variables.

Without `APP_PRIMARY_COLOR`, unspecified values inherit the Orbs light and dark palettes. Explicit JSON values override the generated palette. For a complete rebrand, check both palettes: background, foreground, card and popover surfaces, primary and its foreground, secondary, muted, accent, borders, input, ring, chart and sidebar colors, plus navigation, form, selected tab, and settings surfaces where needed. Changing only `primary` does not recolor these inherited values. Set accessible text/action contrast and keep error semantics recognizable. Geometry and font choices can also be set through the style object; do not change unrelated trading behavior or replace the app's component system.

## Check the actual app

Restart the development server after editing env values. Preview desktop and mobile, both modes, navigation, trading forms, menus and wallet dialog where available. Check focus, disabled states, visible contrast, icon and logo loading, metadata, and overflow. A stored theme can override `APP_DEFAULT_THEME`; use a fresh browser context to check the first visit. Verify `APP_THEME_*` in the rendered CSS and review the real UI rather than just a swatch. Preserve the developer playground when restyling the reference checkout; during partner setup, follow the launch skill’s removal instructions. Run `yarn typecheck`, `yarn lint`, and `yarn build`, and report blocked states. A theme request does not itself authorize deployment.
