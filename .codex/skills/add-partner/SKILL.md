---
name: add-partner
description: Use when adding, updating, or reviewing a white-label partner in this Efficient Frontier swap UI, including partner config, brand assets, styles, metadata, package scripts, Liquidity Hub/RPC partner ids, GitHub Actions deploy options, Vercel secrets, and validation.
---

# Add Partner

Use this skill for partner onboarding work in this repo. The app selects branding with `NEXT_PARTNER`, resolves partner config from `lib/partners/config.ts`, writes partner CSS variables from `lib/partners/styles.ts`, and deploys through `.github/workflows/frontend-deploy.yml`.

## Inputs To Gather

Before editing, identify:

- Partner slug: kebab-case, stable, URL/build friendly, for example `acme-capital`.
- Display name and logo alt text.
- Official URL and metadata title/description.
- Logo/icon assets: navbar mark, favicon/icon, apple icon. Prefer local files in `public/`.
- Color tokens: background, foreground, card, popover, primary, secondary, muted, accent, destructive, border, input, ring, chart/sidebar colors.
- Optional style overrides: radius, font family, selected tab background, settings trigger backgrounds/foreground.
- Deploy target: Vercel project id secret name, usually `VERCEL_PROJECT_ID_<SLUG_UPPER_SNAKE>`.
- Aliases users may type for `NEXT_PARTNER`.

If deriving assets or colors from a website, browse current official sources when allowed or required, and keep usage/license risk in mind. Prefer user-provided assets for exact branding.

## Implementation Workflow

1. Inspect the current worktree first.
   - Run `git status --short`.
   - Do not overwrite unrelated user changes.
   - Read existing partner files before copying patterns.

2. Add public assets.
   - Put brand images in `public/`, using clear names such as `<slug>-logo-mark.svg` or `<slug>-icon.png`.
   - Use SVG/PNG/ICO as appropriate; app metadata infers icon MIME type from extension in `app/layout.tsx`.
   - Keep image dimensions stable and verify they render in the navbar and browser favicon.

3. Create `lib/partners/<slug>.ts`.
   - Import `PartnerConfig`.
   - Export `<camelSlug>Partner`.
   - Use only the existing `PartnerConfig` fields: `id`, `brand`, `styles`.
   - Do not add separate `appId`, `liquidityHubPartner`, or other duplicate partner identifiers. Current integrations use `partner.id`.

Example:

```ts
import type { PartnerConfig } from "./types";

export const acmeCapitalPartner: PartnerConfig = {
  id: "acme-capital",
  brand: {
    name: "Acme Capital",
    logoSrc: "/acme-capital-logo-mark.svg",
    iconSrc: "/acme-capital-icon.png",
    appleIconSrc: "/acme-capital-icon.png",
    logoAlt: "Acme Capital",
    externalUrl: "https://example.com/",
    metadata: {
      title: "Acme Capital",
      description: "Partner-specific app description.",
      url: "https://example.com/",
    },
  },
  styles: {
    radius: "0.625rem",
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    colors: {
      background: "#0a0a0a",
      foreground: "#fafafa",
      card: "#171717",
      cardForeground: "#fafafa",
      popover: "#171717",
      popoverForeground: "#fafafa",
      primary: "#ff37c7",
      primaryForeground: "#ffffff",
      secondary: "#262626",
      secondaryForeground: "#fafafa",
      muted: "#262626",
      mutedForeground: "#a1a1a1",
      accent: "#212121",
      accentForeground: "#fafafa",
      destructive: "#ff6568",
      border: "rgba(255, 255, 255, 0.1)",
      input: "rgba(255, 255, 255, 0.15)",
      ring: "#737373",
      chart1: "#1447e6",
      chart2: "#00bb7f",
      chart3: "#f99c00",
      chart4: "#ac4bff",
      chart5: "#ff2357",
      sidebar: "#171717",
      sidebarForeground: "#fafafa",
      sidebarPrimary: "#1447e6",
      sidebarPrimaryForeground: "#fafafa",
      sidebarAccent: "#262626",
      sidebarAccentForeground: "#fafafa",
      sidebarBorder: "rgba(255, 255, 255, 0.1)",
      sidebarRing: "#737373",
    },
  },
};
```

4. Register the partner in `lib/partners/config.ts`.
   - Import the new partner.
   - Add `export const <SLUG_CONST> = "<slug>";`.
   - Add it to `PARTNERS`.
   - Add useful aliases to `PARTNER_ALIASES`.
   - Confirm `PartnerId` still derives from `PARTNERS`.

5. Keep style plumbing partner-driven.
   - Prefer values in `PartnerStyles` and CSS variables returned by `getPartnerStyleVariables`.
   - If a new visual surface needs partner variance, add an optional key to `PartnerStyles`, map it in `lib/partners/styles.ts`, then consume the CSS variable in components.
   - Avoid hardcoded `[data-partner="..."]` CSS unless the requested style is truly partner-specific and cannot be expressed with existing variables.
   - Do not create broad global CSS overrides for one partner if a component-level variable or prop is enough.

6. Verify app integrations use `partner.id`.
   - `app/layout.tsx` writes `<html data-partner={partner.id}>`, metadata, icons, and root CSS variables.
   - `lib/partners/client.ts` resolves the active client partner from `document.documentElement.dataset.partner`.
   - `lib/hooks/liquidity-hub.ts` passes `partner: getActiveClientPartnerConfig().id`.
   - `lib/rpc-url.ts` sends `appId=<partner.id>` to the RPC proxy.

7. Update package scripts in `package.json`.
   - Add `dev:<slug>`, `build:<slug>`, and `start:<slug>` using `NEXT_PARTNER=<slug>`.
   - Add the new build to `build:partners`.
   - Preserve the current Yarn 1 workflow.

8. Update CI/deploy in `.github/workflows/frontend-deploy.yml`.
   - Add the slug to `workflow_dispatch.inputs.frontend_project.options`.
   - Add the slug to the `all` matrix JSON.
   - Add an env entry for `VERCEL_PROJECT_ID_<SLUG_UPPER_SNAKE>`.
   - Add a `case` branch that sets `next_partner="<slug>"` and `project_id="$VERCEL_PROJECT_ID_<SLUG_UPPER_SNAKE>"`.
   - Keep existing required build env vars: `NEXT_PUBLIC_PROJECT_ID` and `RPC_URL`.
   - Do not change deploy command semantics unless the user explicitly asks.

9. Update README.
   - Add the slug to supported `NEXT_PARTNER` values.
   - Mention the new deploy target.
   - Add the new Vercel project id secret name.

## Validation

Run focused validation after changes:

```bash
yarn lint
yarn build:<slug>
yarn build:partners
```

If `build:partners` is too expensive, at minimum run `yarn build:<slug>` plus one existing partner build. For GitHub Actions edits, inspect the workflow syntax and the `all` matrix string carefully.

For visual changes, run the partner dev server:

```bash
NEXT_PARTNER=<slug> yarn dev
```

Then verify:

- Navbar shows the correct partner logo and name.
- Favicon and apple icon come from the partner config.
- Background, cards, inputs, tabs, selected tab, settings trigger, buttons, modals, and toasts use partner CSS variables.
- Token selector, swap flow, order review, and wallet controls remain readable on desktop and mobile.
- Existing partners still build and do not inherit unintended styling.

## Common Pitfalls

- Do not add separate `appId` or `liquidityHubPartner` fields; use `id`.
- Do not rely on `process.env.NEXT_PARTNER` directly inside client components. Use existing layout/client config plumbing.
- Do not put one-off partner styles in random components when a variable belongs in `PartnerStyles`.
- Do not forget CI `all` matrix and Vercel secret documentation.
- Do not leave old partner aliases, stale README lists, or missing package scripts.
- Do not overwrite dirty files unrelated to the partner task.
