---
name: spot-partner-setup
description: Configure, preview, publish, or update a partner-owned Spot app from a short brief, including branding, deployment, and a separate trading-activation handoff. Use when a user wants to launch, white-label, or set up their own Spot trading app.
---

# Set up a Spot partner app

Turn a partner's brief into a branded copy of this app, preview it, and (when asked) publish it to an authorized host. Keep messages to the user short and non-technical; make routine technical choices yourself.

Assume no development experience. Inspect the checkout, configuration and available authenticated services before asking; infer branding from the brief, supplied website and authorized assets. The agent owns technical setup and troubleshooting. Avoid a questionnaire, don't repeat known information, and defer optional accounts until needed. Ask only for essential business information, account access, or decisions requiring authorization; group questions when useful and explain the next step in everyday language. Do not ask the user to edit files, run commands, choose technical settings, or diagnose errors. Continue independent work while waiting.

## Ground rules

- **Customize, don't rebuild.** Reuse a suitable checkout on its current branch, preserving unrelated changes. If none exists, obtain the official Orbs Spot source in a suitable local folder; a GitHub account or hosted fork is not required for local setup or direct deployment. Create a partner-owned hosted fork only when requested and authorized. Do not propose or create a setup branch, switch branches, scaffold a replacement, reset, reinitialize, or overwrite local changes unless the user explicitly requests it. Follow current source and `README.md` if these instructions are stale.
- **Branding only.** Keep the reference layout, spacing, typography, components, responsive behavior, swap/advanced-order forms, quote protections, wallet guards, history, cancellation and settlement. Change other UI only on explicit request.
- **Nothing invented.** Never fabricate logos, RPC or WalletConnect credentials, contracts, a partner ID, or activation. If something is missing, continue with what you can and report what it blocks.
- **Secrets stay private.** The user may provide an RPC endpoint URL, including its embedded provider credential, for the agent to configure; prefer a secure input method when available. Never ask for passwords, standalone tokens, private keys or seed phrases in chat; the user signs in to services in their own browser. Treat RPC URLs as secrets: never repeat or print them, and never put them in `NEXT_PUBLIC_*` values, source, logs or `DEPLOYMENT.md`.
- **Authorization.** A request to launch or deploy authorizes publishing to the user's intended account within their stated limits. It does not authorize Git commits or pushes to any repository, spending, paid upgrades, auto-recharge, DNS changes, custom-domain purchases, messages to third parties, or signing/sending transactions. Perform these only when explicitly authorized.
- **Publication ≠ activation.** A live site, a build, or SDK initialization does not prove the partner or its chains are enabled for trading. Always report the two separately.

## 1. Read and plan

Read `README.md` (white-label and deploy sections), `.env.example`, the [spot-theme skill](../spot-theme/SKILL.md) and, if present, the ignored `DEPLOYMENT.md`. Reuse the recorded folder, site and settings after verifying they belong to the intended partner. A record may describe a blocked or incomplete launch: resume any unfinished setup and verification. For an established deployment, apply the requested change and run the relevant checks rather than repeating completed setup.

Collect from the brief, asking only for what is missing and necessary:

| Value | Variable | If missing |
| --- | --- | --- |
| App name, logo, light/dark default, primary color | `APP_*` (see spot-theme) | Ask once; offer text-only branding; choose reversible defaults if the user delegated design |
| Spot partner ID | `NEXT_PARTNER` | Use the one supplied by the Portal; otherwise `external`. Don't ask about activation as a routine setup question; clarify or report uncertainty when it matters to the handoff |
| Stable app ID | `APP_ID` | Derive a unique, non-`orbs` camelCase ID from the app name. Distinct from `NEXT_PARTNER` |
| Chains and RPC | `RPC_URLS` (JSON chain ID → URL) or `RPC_URL` (chain-aware gateway) | Reuse existing partner configuration when present. When needed, ask whether they already have an RPC service, briefly explaining that it connects the app to blockchain networks; help them set one up if not. The agent determines and configures the networks |
| WalletConnect project | `NEXT_PUBLIC_PROJECT_ID` | Optional. Without it, injected wallets and Safe still work; explain setup at handoff |

### Help with RPC

- Infer intended networks from the brief, existing partner settings and available service information. Check which networks the app, partner and provider support; do not assume an endpoint for one network supports others. If the intended networks cannot be determined, ask a plain-language question such as which networks their customers should trade on, offering relevant choices. Do not ask for chain IDs or JSON.
- If the user has a provider, help them locate the HTTP endpoint URLs and use a secure input method when available. If they do not, recommend one suitable provider (for example [Alchemy](https://www.alchemy.com/)) after checking its current network coverage, pricing, free-tier limits and payment requirements. Explain any meaningful limits or potential charges before signup; never promise a free plan without verifying it. Respect their preference for a different provider.
- Guide them to sign up or sign in in their own browser, completing authentication themselves. With available tools and authorization, help create or select their project and obtain the endpoint URLs; otherwise give short, current step-by-step guidance using the provider's documentation. Ask the user to share the endpoint URLs only if the agent cannot retrieve them securely. Never request passwords, private keys or recovery phrases. Do not create a paid plan or enable billing without explicit authorization.
- Configure the supplied endpoints yourself and verify their network identities with read-only checks without exposing URLs or credentials. If signup or access is blocked, continue branding and any available preview, explain what remains unavailable, and resume once access is provided. Never use another partner's credentials or substitute a public endpoint without checking its suitability and the user's constraints.

## 2. Configure

1. Use the Node version in `.nvmrc` and the versions documented in `README.md`; run `yarn install --frozen-lockfile`.
2. Put assets in `public/` and reference them with root-relative paths (`/brand/logo.svg`).
3. Write partner values, including supplied RPC endpoints, into the ignored `.env.local`, keeping unrelated entries. Map chain-specific endpoints to `RPC_URLS`, or use `RPC_URL` for a chain-aware gateway. Apply branding with the spot-theme skill. Do not print secret values or expose them in command output.
4. Remember that `NEXT_PARTNER`, `NEXT_PUBLIC_*`, branding and the RPC network list are fixed at build time: restart `yarn dev` and rebuild after changes.

## 3. Turn off developer tools

Partner sites must not expose the reference app's developer UI, unless the user asks to keep it.

- **If `README.md` documents a build-time switch for developer tools, set it off in `.env.local` and the host environment.** Verify the routes and query overrides below even when using the switch.
- Otherwise remove them, scoped to this checkout:
  - `/dev` and child routes, the legacy inspector route, developer navigation, Demo controls, inspectors, walkthroughs, SDK download UI and their now-unused modules (`features/developer-tools/`, `features/eip712-inspector/`, `features/partner-selector/`, `@developer-tools` / `@developer-inspector` aliases, developer-only CSS). Audit all consumers first and replace developer branches with the normal production behavior.
  - `debug=true`, partner/`api=` query overrides, test-backend selection and the `debug` redirects in `next.config.ts`. The configured `NEXT_PARTNER` and production backend must win over any URL parameter.
  - Sample/`mockorders` branches, only after every entry point is gone.
  - Inspector-only dependencies (`prism-react-renderer`, `react-json-view-lite` and its `app/globals.css` import) via Yarn. **Keep** `react-virtuoso`.
- **Do not touch:** real quotes, reviewed minimums, wallet/account/chain guards, order status, cancellation, settlement, `use-spot-partner-chains` network filtering, Orbs attribution and legal links. Before editing `lib/spot/order-link.ts` or `lib/swap/activity.ts`, make sure pending swaps referencing older backends still resolve — never silently drop a pending submission. Consult the SDK skills under `node_modules/@orbs-network/spot-ui/dist/integration-skills/` before touching trading paths.
- Search for leftover `/dev`, `debug`, `mockorders`, inspector and alias references. Confirm `/dev`, its subroutes, the inspector and `?debug=true` no longer expose developer tools, and that old partner and `api=` query overrides cannot change the configured partner or production backend.

## 4. Preview and validate

1. Run `yarn typecheck`, `yarn lint` and `yarn build`; fix failures you introduced.
2. Start `yarn dev` and check the real app at desktop and mobile widths in light and dark: branding, metadata/icons, swap and advanced-order forms (quotes and errors, no signing), history, menus and the wallet dialog.
3. Compare against the unmodified reference at the same sizes and themes: use the reference deployment URL from `README.md` if one is listed; otherwise run the upstream revision from a temporary detached `git worktree` on another port. This worktree is only for comparison; do not switch the partner checkout's branch or create a setup branch. Fix unintended layout differences. If comparison is impossible, say so rather than claiming parity.
4. Show the user an accessible preview where the platform supports one. Do not assume a remote localhost URL is accessible or expose a development server through an insecure tunnel. The current root layout shows an incomplete-setup screen without RPC rather than the trading interface; report this limitation and continue independent work. Do not fabricate credentials or bypass production guards to imply trading works. If the user requested publication, continue to hosting without requesting approval again unless they requested a design review or a decision remains necessary.

## 5. Select hosting and publish

Publish only if requested or authorized by an established update workflow. First reuse a verified existing deployment, then honor the user's chosen provider, then consider a suitable authenticated account with clear ownership and plan eligibility. Otherwise recommend Netlify. Ask one ownership question if the account or team is ambiguous; never guess. If the chosen provider is incompatible or unavailable, explain and offer a compatible alternative. If no suitable account is available or signup is declined, finish independent local work and report what remains pending.

For every host, confirm the installed Next.js version, server route support, build/runtime environment, account plan and current commercial-use terms. Use supported framework-aware builds, never a static export or SPA fallback. Confirm the intended source, configured partner, supported networks, server-only secrets, API input and method restrictions, and shared rate limiting. Verify the draft before production and the stable URL afterward. Preserve existing project linkage and record any available rollback path. Do not request paid changes without authorization. Git-connected deployment is optional and requires explicit authorization for commits and pushes.

For Vercel, use the existing `vercel.json` where suitable and check [current Vercel terms](https://vercel.com/legal/terms) and [CLI guidance](https://vercel.com/docs/projects/deploy-from-cli); Hobby is restricted to personal, non-commercial use. For Cloudflare or another host, check its current official Next.js adapter and route-handler compatibility before choosing it. Do not claim a provider workflow is verified until the actual deployment checks pass.

### Netlify

Help the user create or sign in to their own Netlify account if needed; explain that it hosts their app and guide them through authentication in their browser. Check the actual account, current plan, limits and potential charges. The agent handles the CLI, site selection or creation, settings, build, deployment and checks using available tools; do not ask the user to run commands or configure environment variables. Reuse the verified existing site when there is one. For a new site, pick an available reasonable address based on the app name unless the user supplied a preference, and explain that it can be changed later. Ask only when account ownership, a paid action, or another necessary decision cannot be determined or performed by the agent. If account access or pricing cannot be verified, prepare what is possible and explain what is pending.

Read and follow the shared [Netlify hosting skill](https://github.com/orbs-network/agent-skills/blob/master/skills/netlify-hosting/SKILL.md) for account, cost, site, deployment and hosting verification. This skill delegates choosing an available site address to the agent, including when a suggested name is taken; that overrides the shared skill's instructions to ask for a name. If the shared skill cannot be accessed, follow the checked-in [Netlify fallback](references/netlify-fallback.md) and report that it was unavailable. Apply these Spot-specific requirements in either case:

1. **Build settings.** Use Netlify's [Next.js runtime](https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/) so route handlers deploy as functions — never a static export, `dist/` upload or SPA catch-all. Confirm Netlify supports the installed Next.js version. If no `netlify.toml` exists, add a minimal one:

   ```toml
   [build]
     command = "yarn build"
     publish = ".next"
   ```

   Netlify reads `.nvmrc` for Node; set `YARN_VERSION=1.22.22` in site environment variables.
2. **Environment.** `.env.local` is not uploaded and does not configure the site. Set every value from step 2 in Netlify's site environment for the production and deploy-preview contexts, with build **and** functions scopes (`APP_*` values are needed at runtime too). Mark `RPC_URL`/`RPC_URLS` as secret. See Netlify's [framework environment guide](https://docs.netlify.com/build/frameworks/use-environment-variables-with-frameworks/).
3. **Rate limiting.** `/api/rpc`, `/api/balances` and `/api/transaction-receipt` spend the partner's RPC quota. Configure and verify a shared per-client rate limit for them using the host or a WAF. The app's `RPC_RATE_LIMIT_PER_MINUTE` (default 600) is per instance and is not a distributed limit. If shared protection is unavailable, finish the local build and draft where feasible, explain the remaining exposure and possible quota costs, and ask the user how to proceed before production publication. Record any explicit decision to proceed without it.

Deploy a framework-aware draft and confirm the generated deployment includes the Next.js route handlers as functions. Verify the draft using step 6 before publishing the reviewed source and settings to production. If source, build output or relevant settings differ, rebuild and repeat the affected checks.

## WalletConnect setup

When configuring or handing off WalletConnect, read the shared [WalletConnect setup skill](https://github.com/orbs-network/agent-skills/blob/master/skills/walletconnect-setup/SKILL.md). Keep Spot's `NEXT_PUBLIC_PROJECT_ID` build-time configuration and the verification and handoff steps below. If the shared skill cannot be accessed, follow the [local WalletConnect fallback](references/walletconnect-fallback.md) and report that the shared skill was unavailable. WalletConnect is optional and must not block launch when no ID was supplied.

## 6. Verify

On the draft and then the production URL: HTTPS, branding, metadata and assets, desktop and mobile, light and dark, keyboard access, direct loads and refreshes of routes, and console/network errors. Check that unsupported RPC methods, networks and malformed inputs are rejected without forwarding, and shared limits are enforced; make read-only requests to the server routes for each enabled chain, then check quotes and the wallet dialog. Confirm developer tools stay removed. If WalletConnect is configured, the exact production origin must be allowed in its dashboard; test pairing separately. Do not sign, approve, send or trade without explicit authorization. Report unverified checks as unverified.

## 7. Record and hand off

Create or update the ignored `DEPLOYMENT.md` (also after a blocked launch) with: app name, `APP_ID`, `NEXT_PARTNER`, source folder and upstream revision, asset paths, provider/account/team and site ID, draft and production URLs, pricing source and check date, environment variable names with configured/blank status (never values), rate-limit status, checks performed, and outstanding hosting or activation work. End it with a short update prompt naming the folder, this skill, the record and the site.

Tell the user, briefly:

- the production URL (only once verified), or what is pending;
- what was confirmed about trading activation for `NEXT_PARTNER` and each chain, and what was not;
- optional next steps, including WalletConnect and a custom domain, with an offer to help configure them;
- to return to the Partner Portal if they started there.

## Later updates

Reuse the verified folder, site and settings from `DEPLOYMENT.md`. Resume any unfinished setup or checks recorded there. Keep existing customization, apply the requested change and rerun the relevant checks; when publication is requested, deploy a draft, then production. Pull upstream changes only when the user asks; merge them without discarding partner customization, and re-check step 3 afterwards because upstream may add new developer surfaces.
