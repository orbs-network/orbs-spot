# Playground development and operations

[Start with the integration guide](../README.md). This document covers running and maintaining the reference app.

## Development

Run from the repository root:

```bash
yarn install --frozen-lockfile
yarn dev
```

The app runs on [http://localhost:3000](http://localhost:3000).

The default frontend uses Orbs branding. Forks can configure their identity,
metadata, icons, default color mode and complete light/dark palettes using
`.env.local`; see [white-label setup](../README.md#white-label-setup). The
standard RainbowKit wallet picker remains available. The default Spot partner
is `external` and can be configured with `NEXT_PUBLIC_SPOT_PARTNER`.
Developer tools are available only inside `/dev`. The main trading UI
keeps its normal review and execution flow, including with `debug=true`.
Explicit `debug=true`, `api=dev`, `api=v1`, or `api=v2` enables partner testing without exposing developer controls,
inspection buttons, demos, or the wizard outside `/dev`.

Open `/dev` for the developer playground. This route enables the walkthrough,
demos, step-by-step execution, SDK examples, and larger data panels without a
`debug` query parameter. It reuses the main trading forms, validation, order clients,
and wallet providers. The initial walkthrough keeps the original step order,
modal overlay, keyboard focus containment, and outside-click/Escape dismissal.
Mobile uses a bottom drawer. Each walkthrough is shown once per browser, and
desktop highlighting waits for the target and fonts to settle before appearing.
`/dev/orders` provides order tools, and `/dev/eip712` hosts
the full order preview. Tools use the existing trading navigation. The desktop
**More** menu and mobile navigation menu provide order preview, sample orders,
and **Back to trading**, which returns to the main UI without sample-order flags
while preserving debug and partner context. Existing
`/developers/eip712?debug=true` links redirect to `/dev/eip712`, preserving drafts.

Open `/?tab=twap&debug=true` to show the searchable Spot partner selector beside
the chain selector for every trading form. It loads the available integration partners from the Spot
configuration used by `projects/spot-ui`. Selection is saved as `partner=<name>`
in the URL and applies to order configuration, creation, history, and cancellation.
The same partner selector is enabled automatically by `api=dev`, `api=v1`, and `api=v2`.
Internal navigation preserves the API and partner selection. Without `debug=true` or one of those
recognized API overrides, the partner URL override is ignored and the configured integration partner is used.
Orders also show a Partner column in debug mode, using the partner retained
with each fetched order.
The selected Spot partner also applies to swaps;
developer tools stay inside `/dev`, even when `debug=true` is passed.
For a non-default configured partner or in debug mode, the network picker lists only chains supported by the selected
partner. An incompatible connected network shows **Wrong network**, and the
order action offers a switch to a compatible network.

Swap and advanced-order forms share the same 23 supported networks and partner filtering,
excluding Fantom and Polygon zkEVM. Wallets and public clients also retain Blast for legacy swap activity.
See the [Spot swap integration guide](https://github.com/orbs-network/spot-ui/tree/master/skills/spot-swap-integration)
for quoting and capability checks. Swap and advanced-order creation require a valid partner/chain
configuration returned by the Spot SDK.

## Spot API selection

The default Spot service is `https://order-sink-v2.orbs.network`. Add `?api=dev` to use
`https://order-sink-dev.orbs.network`, `?api=v1` to use `https://order-sink.orbs.network`,
or `?api=v2` to select production v2 explicitly.
An absent, empty, or unrecognized `api` value uses the default service without enabling implicit debug mode.
The parameter works on the main app and `/dev` without `debug=true`.
`api=dev`, `api=v1`, and `api=v2` automatically enable debug partner testing: the partner selector,
supported-network filtering, and the Partner column in order history. Developer inspectors,
demos, and walkthroughs remain inside `/dev`. Internal links preserve the selected API and partner
without adding `debug=true`; clearing the API selection disables implicit debug features unless
`debug=true` was explicitly set.

The selected service handles order submission, history, and order-status reads.
SDK configuration and `client.getQuote` always use production v2 at
`https://order-sink-v2.orbs.network`; cancellation configuration comes from that service too.
Clients, reviewed swap attempts, history, and retained swap activity include the order backend in their identity, and
changing services requires a fresh review before wallet work continues. Internal navigation
preserves `api`, and developer inspectors and downloads show the effective API URL.
Standalone token USD pricing always uses the SDK's production pricing service.

## Build

```bash
yarn build
```

## WalletConnect

WalletConnect uses `NEXT_PUBLIC_PROJECT_ID` as the Reown project id. The
current browser domain must be added to that project in Reown Dashboard under
Project Domains, otherwise the WalletConnect modal can show
`Invalid App Configuration`.

For mobile testing, allow the exact origin you open on the phone, for example
the production domain, tunnel domain, or local network host. `NEXT_PUBLIC_APP_URL`
only controls the app metadata sent to wallets; it does not replace Reown's
domain allowlist check.

## Deploy

Build the main Orbs app locally and deploy directly to production with `yarn deploy` or
[`scripts/deploy.sh`](../scripts/deploy.sh). It always targets production on
Vercel project `prj_sIICLUBkrigIaJiTQMEPxfgqoRf4`, regardless of the locally linked project.

Install Vercel CLI (verified with 58.9.0) and authenticate once:

```bash
npm install --global vercel@58.9.0
vercel login
```

Set `NEXT_PUBLIC_PROJECT_ID` (the Reown/WalletConnect ID, separate from the Vercel
project ID) and `RPC_URL` in your local `.env` or `.env.local`. Optional public
settings such as `NEXT_PUBLIC_APP_URL` are loaded too. The script uses Next.js's
production environment order: exported
shell values, `.env.production.local`, `.env.local`, `.env.production`, `.env`.
Variables pulled from the selected Vercel environment fill any remaining gaps.
The script discards the automatically pulled `VERCEL_OIDC_TOKEN`; deployment
authentication uses `vercel login` or `VERCEL_TOKEN`.

The script pulls production project settings, runs `vercel build --prod` locally to produce
`.vercel/output`, then uploads that output with `vercel deploy --prebuilt --prod`.
Application compilation happens locally; Vercel publishes the prebuilt artifacts.
It stops before building if required variables are missing and never deploys after
a failed build. `RPC_URL`, the documented branding `APP_*` variables, and `NEXT_PUBLIC_*` values are also
forwarded as deployment runtime variables; other local secrets are not forwarded.
Local `.env` files are not uploaded as source files or overwritten by the pull.
Next.js tracing excludes `.env*` files. Because Vercel's builder also adds these
files independently, the script removes their generated function manifest
references before upload, including in build-only mode. Runtime variables are
supplied separately. Rebuild with this script before retrying an older failed
prebuilt deployment.

```bash
yarn deploy --dry-run     # Show the steps without building or deploying
yarn deploy --build-only  # Pull settings and build locally, without deploying
yarn deploy               # Build locally and deploy prebuilt production
yarn deploy --prod        # Same production workflow; --prod is optional
```

The script uses the repository root even when invoked from another directory,
waits for Vercel to finish, and returns its exit status. Run `yarn lint` and
`yarn typecheck` before deploying. For CI, export `VERCEL_TOKEN` and the project's
`VERCEL_ORG_ID`; the script supplies `VERCEL_PROJECT_ID` automatically.
Credentials are never printed by the dry run.
The script disables Vercel CLI telemetry for its commands to avoid telemetry
subprocess crashes after successful local builds.

See the [Vercel local build workflow](https://vercel.com/docs/cli/build),
[deployment options](https://vercel.com/docs/cli/deploy), and
[project selection options](https://vercel.com/docs/cli/global-options#project).

## Production and developer boundaries

Trading components live in `components/advanced-order`, `features/swap`, and `features/order-history`. Wallet UI lives in `features/wallet-connection`. Execution logic is isolated from React in `lib/spot` and `lib/swap`; server request validation lives in `lib/server`.

Developer inspectors and simulations live in `features/developer-tools`, with copyable example generators in its `snippets` directory. Import their UI only through `@developer-tools`. ESLint enforces the production import boundary. Developer tools load only inside `/dev`; `debug=true` on the main UI enables partner testing without loading developer implementations.

Before release, run `yarn lint`, `yarn typecheck`, and `yarn build`. Production hosting should enforce request rate limits for the public RPC endpoints and provide `RPC_URL` and `NEXT_PUBLIC_PROJECT_ID` through its environment configuration.

Dependency security overrides in `package.json` keep Axios, viem's WebSocket client, Protobuf, browser mapping data, and MetaMask's UUID utility on patched releases. Remove these overrides when upstream dependency ranges include the fixes. MetaMask uses the compatible UUID v4 API; its override retains CommonJS support.

The October 1, 2026 production dependency audit reports no known vulnerabilities. WalletConnect is on 2.25.0, within wagmi’s supported range; its dependency chain removes the vulnerable legacy URL decoder. Re-run `yarn audit --groups dependencies` before release.

## Spot SDK history endpoints

The SDK provides `getv1orders: false` to avoid merging a secondary order-sink service into history.
Both history views and the developer example pass this option with the selected `apiUrl`.
Without an API selection they read `https://order-sink-v2.orbs.network`; `api=dev`, `api=v1`, and `api=v2`
select the same services used for submission and status reads. Configuration and quotes remain on production v2.

Account, chain, and exchange filters are preserved. `legacyOrders` controls legacy subgraph reads separately,
and the developer example disables those too. History only includes orders returned by the selected service.
