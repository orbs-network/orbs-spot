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
is `external` and can be configured with `NEXT_PARTNER`.
Developer tools and debug query overrides are available in local development and
deployed builds. Developer tools are confined to `/dev`; `debug=true` and
recognized `api` overrides enable partner testing on the main trading UI.
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
For a known non-default SDK partner or in debug mode, the network picker uses
the published partner network list. Custom identifiers not represented by the
SDK enum use the host-supported networks and rely on the SDK configuration and
quote response for availability. An incompatible connected network shows **Wrong network**, and the
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
The parameter works on the main app and `/dev` without `debug=true`, including in deployed builds.
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

WalletConnect uses the optional `NEXT_PUBLIC_PROJECT_ID` as the Reown project id.
Without it, browser-injected wallets and Safe apps remain available, but
WalletConnect pairing is disabled. The
current browser domain must be added to that project in Reown Dashboard under
Project Domains, otherwise the WalletConnect modal can show
`Invalid App Configuration`.

For mobile testing, allow the exact origin you open on the phone, for example
the production domain, tunnel domain, or local network host. `NEXT_PUBLIC_APP_URL`
only controls the app metadata sent to wallets; it does not replace Reown's
domain allowlist check.

## Deploy

Deploy to a hosting project you control using a workflow that supports Next.js
server routes. Follow the [fork deployment steps](../README.md#deploy-your-fork).
For self-hosting, place a reverse proxy in front of the app. Configure a shared
per-client limit for `/api/rpc`, `/api/balances`, and `/api/transaction-receipt`
at the proxy or hosting WAF. [An nginx snippet](rate-limit.nginx.conf) shows one
starting point; tune it for expected traffic and configure trusted proxies.

`RPC_RATE_LIMIT_PER_MINUTE` controls a per-instance RPC ceiling (default 600
requests per minute; `0` disables it). Depending on the host, isolated routes
may each have their own counter. This limits an individual instance and returns HTTP 429
with `Retry-After`, but it is not a per-client or distributed limit. Serverless
and multi-instance deployments still require the shared host-level limit. Keep
RPC endpoints and credentials server-side. RPC network IDs and the partner are
selected at build time; supply matching RPC configuration at runtime.

## Production and developer boundaries

Trading components live in `components/advanced-order`, `features/swap`, and `features/order-history`. Wallet UI lives in `features/wallet-connection`. Execution logic is isolated from React in `lib/spot` and `lib/swap`; server request validation lives in `lib/server`.

Developer inspectors and simulations live in `features/developer-tools`, with copyable example generators in its `snippets` directory. Import their UI only through `@developer-tools`. ESLint enforces the production import boundary. Developer tools load only inside `/dev`; `debug=true` on the main UI enables partner testing without loading developer implementations.

Before release, run `yarn lint`, `yarn typecheck`, and `yarn build`. Production hosting must enforce shared request rate limits for the public RPC endpoints and provide `RPC_URLS` or `RPC_URL` through its environment configuration. Set `NEXT_PUBLIC_PROJECT_ID` at build time if WalletConnect is needed.

Dependency overrides in `package.json` keep Axios, viem's WebSocket client, and MetaMask's UUID utility on patched releases. Remove these overrides when upstream dependency ranges include the fixes. MetaMask uses the compatible UUID v4 API; its override retains CommonJS support.

Run `yarn audit --groups dependencies` before release and assess the current advisories against the deployment. Wallet dependencies currently pin Zod 3, affected by [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5); Zod 4 cannot safely be forced into their incompatible dependency ranges without upstream updates.

## Spot SDK history endpoints

The SDK provides `getv1orders: false` to avoid merging a secondary order-sink service into history.
Both history views and the developer example pass this option with the selected `apiUrl`.
Without an API selection they read `https://order-sink-v2.orbs.network`; `api=dev`, `api=v1`, and `api=v2`
select the same services used for submission and status reads. Configuration and quotes remain on production v2.

Account, chain, and exchange filters are preserved. `legacyOrders` controls legacy subgraph reads separately,
and the developer example disables those too. History only includes orders returned by the selected service.
