---
name: add-partner
description: Use when adding, updating, or reviewing a white-label partner in this Efficient Frontier swap UI. If the user provides a partner website, inspect it and derive the partner config, brand assets, metadata, colors, backgrounds, fonts, package scripts, Liquidity Hub/RPC partner ids, GitHub Actions deploy options, Vercel secrets, and validation from that site whenever possible.
---

# Add Partner

Use this skill for partner onboarding work in this repo. The app selects branding with `NEXT_PARTNER`, resolves partner config from `lib/partners/config.ts`, writes partner CSS variables from `lib/partners/styles.ts`, and deploys through `.github/workflows/frontend-deploy.yml`.

## Inputs To Gather

Before editing, identify the following. If the user provides a website, derive these from the website first and only ask for missing or ambiguous details.

- Partner slug: kebab-case, stable, URL/build friendly, for example `acme-capital`.
- Display name and logo alt text.
- Official URL and metadata title/description.
- Logo/icon assets: navbar mark, favicon/icon, apple icon. Prefer local files in `public/`.
- Color tokens: background, foreground, card, popover, primary, secondary, muted, accent, destructive, border, input, ring, chart/sidebar colors.
- Visual style inputs: font family, border radius, page backgrounds, surface backgrounds, selected tab background, settings trigger backgrounds/foreground, CTA/link colors, gradients or image backgrounds that should influence the app palette.
- Deploy target: Vercel project id secret name, usually `VERCEL_PROJECT_ID_<SLUG_UPPER_SNAKE>`.
- Aliases users may type for `NEXT_PARTNER`.

## Website-First Brand Extraction

When the user gives a partner website URL, do not ask the user for brand data that can reasonably be extracted. Browse or fetch the current official website, then gather:

- **Identity**: canonical URL, site title, `og:title`, application/site name, logo alt text, footer/company name, and likely slug aliases from domain/name variants.
- **Metadata**: `<title>`, meta description, `og:description`, `twitter:description`, canonical URL, and any JSON-LD Organization/WebSite name/description.
- **Icons**: favicon links, SVG/PNG/ICO icons, `apple-touch-icon`, web manifest icons, mask icon, and Open Graph image candidates. Prefer a clean SVG/PNG logo for navbar and a square favicon/apple icon for metadata.
- **Logo assets**: header/nav logos, footer logos, SVG symbol marks, image `alt` text, CSS background logos, and JSON-LD logo values. Prefer official site assets; if multiple logos exist, choose the clearest header/nav mark for the app.
- **Colors**: sample CSS custom properties, computed styles for body text/background, header/nav, cards/surfaces, primary CTA buttons, links, focus states, borders, disabled/muted text, destructive/error colors, and prominent chart/accent colors. Use screenshots or computed styles when CSS is hard to inspect.
- **Backgrounds**: body/page backgrounds, hero/background images, gradients, panel/card colors, overlays, and texture/pattern cues. Translate these into partner color tokens instead of copying decorative complexity unless the user explicitly wants it.
- **Fonts**: computed `font-family` for body/headings/buttons, loaded Google/self-hosted font names, fallback stacks, and font weights. Use the font stack in `PartnerStyles`; only download or bundle fonts if licensing and project patterns clearly allow it.

Extraction guidance:

- Prefer official site data over search snippets. If a site blocks access, is sparse, or assets are ambiguous, state the gap and ask for only the missing decision.
- Keep usage/license risk in mind. For partner-owned official assets, copying logos/favicons into `public/` is acceptable for white-label setup; avoid copying unrelated marketing photos or licensed fonts without explicit permission.
- Preserve original asset formats when practical. Convert only when needed for app metadata/rendering, and keep filenames clear, for example `<slug>-logo.svg`, `<slug>-icon.png`, `<slug>-apple-icon.png`.
- Map brand colors into the existing `PartnerStyles.colors` shape. Prioritize readable UI contrast over perfectly literal website colors.
- If extracted colors produce poor contrast on this app, adjust nearby shades conservatively and mention the adjustment.

## Implementation Workflow

1. Inspect the current worktree first.
   - Run `git status --short`.
   - Do not overwrite unrelated user changes.
   - Read existing partner files before copying patterns.

2. If a website URL was provided, extract brand data before editing app files.
   - Fetch or browse the site and capture the identity, metadata, assets, colors, backgrounds, and fonts listed above.
   - Save official logo/icon assets into `public/` with stable filenames.
   - Use the extracted metadata/title/description/URL in `brand.metadata`.
   - Use the extracted font stack and colors in `styles`, adjusting only for readability.
   - Keep a short note for the final answer describing what was derived from the website and any assumptions.

3. Add public assets.
   - Put brand images in `public/`, using clear names such as `<slug>-logo-mark.svg` or `<slug>-icon.png`.
   - Use SVG/PNG/ICO as appropriate; app metadata infers icon MIME type from extension in `app/layout.tsx`.
   - Keep image dimensions stable and verify they render in the navbar and browser favicon.

4. Create `lib/partners/<slug>.ts`.
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

5. Register the partner in `lib/partners/config.ts`.
   - Import the new partner.
   - Add `export const <SLUG_CONST> = "<slug>";`.
   - Add it to `PARTNERS`.
   - Add useful aliases to `PARTNER_ALIASES`.
   - Confirm `PartnerId` still derives from `PARTNERS`.

6. Keep style plumbing partner-driven.
   - Prefer values in `PartnerStyles` and CSS variables returned by `getPartnerStyleVariables`.
   - If a new visual surface needs partner variance, add an optional key to `PartnerStyles`, map it in `lib/partners/styles.ts`, then consume the CSS variable in components.
   - Avoid hardcoded `[data-partner="..."]` CSS unless the requested style is truly partner-specific and cannot be expressed with existing variables.
   - Do not create broad global CSS overrides for one partner if a component-level variable or prop is enough.

7. Verify app integrations use `partner.id`.
   - `app/layout.tsx` writes `<html data-partner={partner.id}>`, metadata, icons, and root CSS variables.
   - `lib/partners/client.ts` resolves the active client partner from `document.documentElement.dataset.partner`.
   - `lib/hooks/liquidity-hub.ts` passes `partner: getActiveClientPartnerConfig().id`.
   - `lib/rpc-url.ts` sends `appId=<partner.id>` to the RPC proxy.

8. Update package scripts in `package.json`.
   - Add `dev:<slug>`, `build:<slug>`, and `start:<slug>` using `NEXT_PARTNER=<slug>`.
   - Add the new build to `build:partners`.
   - Preserve the current Yarn 1 workflow.

9. Update CI/deploy in `.github/workflows/frontend-deploy.yml`.
   - Add the slug to `workflow_dispatch.inputs.frontend_project.options`.
   - Add the slug to the `all` matrix JSON.
   - Add an env entry for `VERCEL_PROJECT_ID_<SLUG_UPPER_SNAKE>`.
   - Add a `case` branch that sets `next_partner="<slug>"` and `project_id="$VERCEL_PROJECT_ID_<SLUG_UPPER_SNAKE>"`.
   - Keep existing required build env vars: `NEXT_PUBLIC_PROJECT_ID` and `RPC_URL`.
   - Do not change deploy command semantics unless the user explicitly asks.

10. Update README.
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
- Metadata title/description/url match the official website-derived values.
- App colors, primary buttons, backgrounds, surfaces, and typography feel recognizably connected to the source website while staying readable.
- Background, cards, inputs, tabs, selected tab, settings trigger, buttons, modals, and toasts use partner CSS variables.
- Token selector, swap flow, order review, and wallet controls remain readable on desktop and mobile.
- Existing partners still build and do not inherit unintended styling.

## Common Pitfalls

- Do not add separate `appId` or `liquidityHubPartner` fields; use `id`.
- Do not rely on `process.env.NEXT_PARTNER` directly inside client components. Use existing layout/client config plumbing.
- Do not put one-off partner styles in random components when a variable belongs in `PartnerStyles`.
- Do not ask the user for title, description, favicon, logo, colors, backgrounds, or fonts when they provided a website and those values are extractable.
- Do not blindly copy low-contrast website colors into the app if they make controls unreadable.
- Do not forget CI `all` matrix and Vercel secret documentation.
- Do not leave old partner aliases, stale README lists, or missing package scripts.
- Do not overwrite dirty files unrelated to the partner task.
