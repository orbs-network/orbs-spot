# Spot integration example

Use this repository to add Spot swaps, TWAP, limit, stop-loss, or take-profit orders to an app.
It uses `@orbs-network/spot-ui` 2.2.9 with the app’s own wallet and UI.

## Start here

1. Read [the example guide](examples/spot/README.md), then choose [swaps](examples/spot/spot-swap.ts) or [advanced orders](examples/spot/advanced-orders.ts).
2. Adapt that flow to your app’s wallet, tokens, chain, and Spot partner. Reuse your existing services.
3. Validate the integration with the checks below and the browser demo.

For SDK integration guidance, start with [the example guide](examples/spot/README.md)
and the version-matched skills bundled with the installed SDK.

## White-label setup

Copy `.env.example` to `.env.local`, set either `RPC_URLS` or `RPC_URL`, and
configure your brand before building. Set `NEXT_PUBLIC_PROJECT_ID` to enable
WalletConnect and mobile pairing; without it, browser-injected wallets and Safe
apps can still connect. `APP_ID` identifies the fork in RPC
requests and disables the Orbs-specific visual overrides; give each deployment a
stable, unique ID. Set `APP_NAME`, `APP_WORDMARK`, `APP_LOGO_URL`, `APP_LOGO_ALT`,
`APP_ICON_URL`, `APP_APPLE_ICON_URL`, `APP_TITLE`, `APP_DESCRIPTION`,
`APP_TRADING_LABEL` and `NEXT_PUBLIC_APP_URL` for your brand and wallet metadata. Put local images in
`public/` and refer to them by an absolute path such as `/brand/logo.svg`.
Leave the optional wordmark empty if the logo already contains your name.

`APP_DEFAULT_THEME` chooses `light` or `dark` on a first visit; visitors can
still switch modes. Set `APP_PRIMARY_COLOR` to a six-digit hex color (for example,
`APP_PRIMARY_COLOR='#2563eb'`) to generate coordinated light and dark palettes. Set a non-Orbs `APP_ID` for custom branding. `APP_THEME_LIGHT` and `APP_THEME_DARK` are JSON objects
containing any of the style and color properties in
[PartnerStyles](lib/partners/types.ts). For example:

```dotenv
APP_THEME_LIGHT='{"fontFamily":"Arial, sans-serif","radius":"1rem","colors":{"background":"#ffffff","primary":"#175cd3","primaryForeground":"#ffffff"}}'
APP_THEME_DARK='{"colors":{"background":"#101828","primary":"#84adff","primaryForeground":"#101828"}}'
```

Without `APP_PRIMARY_COLOR`, unspecified values retain the reference palette.
With it, explicit theme JSON values override the generated palette. Check text
contrast and branding in both modes. Color values are CSS
values; avoid semicolons or braces. Settings are applied at build time: rebuild
when changing them. Set the same `APP_*` values in the server runtime environment too, so dynamic
pages and RPC requests use the same branding and identity.
Never put secrets in `NEXT_PUBLIC_` variables, which are
included in browser bundles.

Set `NEXT_PARTNER` to your actual Spot partner identifier (the default is
`external`). It is included in the browser bundle at build time and is not a
secret. Confirm that partner is enabled for the chains you intend to support
before live trading. The developer playground remains available at `/dev` in
local and deployed builds, including the Demo and SDK examples.

## Deploy your fork

1. In `.env.local`, set your brand and `NEXT_PARTNER`. To enable WalletConnect,
   create a partner-owned project, set `NEXT_PUBLIC_PROJECT_ID`, and allow the
   exact site origin in its dashboard. Set `NEXT_PUBLIC_APP_URL` to that origin.
2. Configure `RPC_URLS` as a JSON object mapping supported chain IDs to private
   HTTP(S) RPC URLs, for example `'{"1":"https://ethereum.example","56":"https://bsc.example"}'`.
   With `RPC_URLS` alone, only the listed trading networks appear. Alternatively,
   use `RPC_URL` for a chain-aware gateway that accepts `chainId` and `appId`
   query parameters. If both are set, unmapped chains use the gateway. The app
   verifies `eth_chainId` before using an RPC endpoint.
3. Set the same build and server environment values on a host that supports
   Next.js server routes. `NEXT_PARTNER`, `NEXT_PUBLIC_*`, branding, and the
   configured RPC network IDs are selected at build time; rebuild after changes.
   `RPC_URLS` and `RPC_URL` remain server-side. Never put keys in public values.
4. Protect `/api/rpc`, `/api/balances`, and `/api/transaction-receipt` with your
   host's shared per-client rate limiter or WAF. `RPC_RATE_LIMIT_PER_MINUTE`
   sets an additional per-instance ceiling (default 600; `0` disables it).
   Instance limits are not shared across servers and do not replace host-level limits.
5. Run `yarn typecheck`, `yarn lint`, `yarn build`, and `yarn audit --groups dependencies`.
   On the actual host, verify each enabled network's RPC chain, token data, prices,
   quotes, and wallet connection. Confirm partner activation separately; use
   read-only checks unless real trading is explicitly authorized.

## Set up a fork with an agent

Repository-local skills guide an agent through branding, configuration, and
verification: [spot-partner-setup](.agents/skills/spot-partner-setup/SKILL.md)
and [spot-theme](.agents/skills/spot-theme/SKILL.md). In an agent chat opened
on your fork, you can start with a prompt such as:

> Use spot-partner-setup to brand this app as Acme Swap. Use my logo at
> `./acme-logo.svg`, a dark theme, and `#3b82f6` as the primary color.
> Choose sensible defaults for missing visual details and show me the local
> preview.

The partner setup skill removes developer tools from a partner fork by default,
unless the user asks to retain them. This reference app keeps them when deployed.

Supply your actual Spot partner identifier and partner-owned WalletConnect and
RPC configuration when available. Never paste private keys or seed phrases into
an agent prompt. For a later appearance-only change, ask for `spot-theme`.
Configure deployment for your own fork and hosting project.

## The SDK flow

The swap form accepts an input amount or a receive target. Output entry calls
`client.getQuote({ inToken, outToken, outAmount, user, slippage })` for the same pair.
Review the returned `quote.request.inAmount` as the fixed spend before wallet actions.
Before quoting, automatic slippage uses `getSwapSlippage` with the typed amount's USD value.
Selecting tokens starts cached USD-price queries before an amount is entered; quoting reuses those prices.
The app owns this cache; each standalone SDK price call makes a fresh cancellable request.
USD displays and minimum-value checks use those token prices rather than quote USD metadata.
Pricing waits up to 1.5 seconds and falls back to the baseline when unavailable; custom slippage stays unchanged.
Review displays the percentage captured in the quote.
Preparation signs that percentage in basis points and preserves the quote's minimum unchanged.

The host confirms wrapping and allowance, then prepares, signs, and submits:

```ts
const prepared = await client.prepareSwap({ quote, account, signal });
// Review prepared.quote: preparation can refresh a quote older than 20 seconds.
const { signerAddress, typedData } = prepared.signingRequest;
const signature = await walletClient.signTypedData({ ...typedData, account: signerAddress });
const accepted = await client.submitSwap(prepared.order, signature);
// Acceptance is not a fill. Poll client.getOrder({ orderId: accepted.id, signal }).
```

Advanced orders use `calculateOrder({ orderType, ...inputs })`, then
`client.prepareOrder({ form, account, inputTokenAddress, outputTokenAddress })` and `client.submitOrder`.
The [standalone examples](examples/spot/) show the surrounding wallet steps and status handling.

## Find the app implementation

| Task | Start with |
| --- | --- |
| Quote request and request identity | [lib/swap/quotes.ts](lib/swap/quotes.ts) |
| Token USD-price cache | [lib/spot/prices.ts](lib/spot/prices.ts) |
| Swap wallet sequence | [lib/swap/execution.ts](lib/swap/execution.ts) |
| Fill polling | [lib/swap/settlement.ts](lib/swap/settlement.ts) |
| Reload recovery | [lib/swap/activity.ts](lib/swap/activity.ts) |
| Advanced-order calculation | [components/advanced-order/use-order-form.ts](components/advanced-order/use-order-form.ts) |
| Advanced-order wallet sequence | [lib/spot/execution.ts](lib/spot/execution.ts) |
| Wallet adapter | [components/advanced-order/hooks.tsx](components/advanced-order/hooks.tsx) |
| Client cache and wallet history | [lib/spot/queries.ts](lib/spot/queries.ts) |
| Cancellation | [lib/spot/cancellation.ts](lib/spot/cancellation.ts) |
| Downloadable code source | [sdk-flow-examples.ts](features/developer-tools/snippets/sdk-flow-examples.ts) |

Execution modules work independently of React. React hooks connect them to the playground’s state,
wallet, and controls. Use the standalone examples to learn the SDK calls; use the app executors
when studying duplicate guards, wallet changes, and background submissions.

## Run and verify

Use Node 22.23.1 and Yarn 1.22.22, the versions used to verify this app.

```bash
yarn install --frozen-lockfile
yarn dev
```

Open [the developer playground](http://localhost:3000/dev). Select a pair, enter an amount,
and choose **Demo** to step through the integration without signing or submitting.
Use `/dev?tab=twap` for advanced orders and `/dev/orders?mockorders=true` for sample history.
For WalletConnect, allow the exact site origin in the Reown project dashboard;
`NEXT_PUBLIC_APP_URL` supplies wallet metadata and does not replace that allowlist.

```bash
yarn typecheck  # Includes the standalone TypeScript examples
yarn lint
yarn build
```

Keep the standalone examples aligned with the playground downloads in
`features/developer-tools/snippets/sdk-flow-examples.ts`.

SDK instructions matching the installed version are bundled under
`node_modules/@orbs-network/spot-ui/dist/integration-skills/`: `spot-swap-integration/SKILL.md`
for swaps and `spot-advanced-orders-integration/SKILL.md` for advanced orders, history, and cancellation.
See also the SDK repository guides for [swaps](https://github.com/orbs-network/spot-ui/tree/master/skills/spot-swap-integration)
and [advanced orders](https://github.com/orbs-network/spot-ui/tree/master/skills/spot-advanced-orders-integration),
[integration documentation](https://docs.orbs.com/), and [live playground](https://spot-app.orbs.com/).
