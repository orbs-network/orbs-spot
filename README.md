# Orbs Spot — TypeScript SDK Example

A working reference integration for `@orbs-network/spot-ui` and `@orbs-network/liquidity-hub-sdk`.
The playground uses Next.js/React for its UI, wagmi/viem for its wallet, Zustand for editable state,
and TanStack Query for reads and async actions. Spot calculation and execution use the framework-neutral SDK directly;
there is no `@orbs-network/spot-react` dependency or Spot provider.

- [Playground](https://spot-app.orbs.com/)
- [Integration documentation](https://docs.orbs.com/)
- [SDK integration skill](https://github.com/orbs-network/spot-ui/tree/master/skills/spot-integration)

## Where to start

| Responsibility | Source |
| --- | --- |
| Wallet port and submission sequence | [`lib/spot/execution.ts`](lib/spot/execution.ts) |
| Confirmed cancellation through the SDK | [`lib/spot/cancellation.ts`](lib/spot/cancellation.ts) |
| History display mapping and token units | [`lib/spot/history.ts`](lib/spot/history.ts) |
| Editable form input type | [`lib/spot/form.ts`](lib/spot/form.ts) |
| Host inputs → `calculateOrderForm` | [`components/advanced-order/use-order-form.ts`](components/advanced-order/use-order-form.ts) |
| Cached SDK client, history polling, cancellation | [`components/advanced-order/use-order-client.ts`](components/advanced-order/use-order-client.ts) |
| Host wallet adapter | [`components/advanced-order/hooks.tsx`](components/advanced-order/hooks.tsx) |
| Execution state → existing UI | [`components/advanced-order/use-order-execution.ts`](components/advanced-order/use-order-execution.ts) |
| Copyable standalone TypeScript flows | [`features/developer-tools/snippets/sdk-flow-examples.ts`](features/developer-tools/snippets/sdk-flow-examples.ts) |

The files in `lib/spot` do not import React, wagmi, or a UI store. Reuse these with your own wallet
adapter, or follow the SDK calls directly. The app hooks demonstrate how this host connects those calls
to its existing state and controls; another frontend can provide its own bindings.

The host uses `useMutation` for submission, cancellation, wallet writes and developer actions.
`useQuery` owns configuration, history, balances, allowances, quotes and prices. Reads needed during
execution use `queryClient.fetchQuery`; allowance checks always reread chain state, and confirmed
receipts are cached by chain and transaction hash. Successful writes invalidate the affected wallet's queries.

### Integration flow

1. Reuse `createClient(partner, chainId)` through your host cache. Include both partner and chain in its key;
   leave configuration failures retryable. An enabled Orbs partner is required.
2. Map editable inputs, balances, token decimals, USD prices and the current raw output quote into
   `calculateOrderForm`. Its result owns defaults, validation, trade counts, prices and schedules.
   This playground uses token USD prices for its advanced-order market reference; a DEX should supply
   its current router quote for the complete input amount. Omit obsolete quotes while loading.
3. Adapt your wallet to `SpotWalletPort`. Transaction writes must resolve after successful receipts,
   and `assertContext` must verify the connected account and chain before wallet actions.
4. Create one `createOrderExecutor(onChange)` per form. Submit its reviewed snapshot with the SDK client,
   wallet adapter, account and tokens. It wraps native input, approves the exact raw amount if needed,
   verifies allowance, prepares immediately before signing, and forwards the original signature unchanged.
5. Use `client.getAccountOrders({ account, signal })` for history and `order.historyKey` for row/cache identity.
   V2 history fetches all orders using the configured partner and chain, without exchange or pagination filters.
6. Cancel using `client.getCancelOrderRequest(order)` and a confirmed wallet write, then refetch history.
   The app refreshes while history is open and pauses polling in background tabs.
   Fill notifications and post-fill balance updates follow those reads or explicit refreshes;
   this example does not run a continuous background order monitor.

Submission is never automatically retried. After a network failure during submission, check history
before attempting another order. Completed native wrapping is retained across an explicit retry.

### Demo mode

Open `/?devMode=true&tab=twap` and choose **Demo** to inspect calculation, signing, and submission stages
without sending wallet transactions. **Live** uses the connected wallet. Limit, stop-loss and take-profit
forms use the same SDK calculation and execution path.

## Verification

```bash
yarn typecheck
yarn test
yarn lint
```

Execution tests use fake wallet/client ports to verify sequencing, raw amounts, signature preservation,
wallet changes, duplicate clicks, rejection, retry behavior and history identity without placing orders.

## Development

Run from the repository root:

```bash
yarn install --frozen-lockfile
yarn dev
```

The app runs on [http://localhost:3000](http://localhost:3000).

White-label styling is selected with `NEXT_PARTNER`.

Supported values:

- `default`
- `crymbo`
- `efficient-frontier`
- `ginco`
- `ht-digital`
- `orbs`

Run `yarn dev:orbs` for the Orbs frontend, or set `NEXT_PARTNER=orbs` when building.

Orbs enables the custom wallet chooser with `features.customConnectModal` in
`lib/partners/orbs.ts`. Set `NEXT_PUBLIC_ORBS_CONNECT_MODAL=false` before starting
or building to restore the standard RainbowKit picker. This flag has no effect
on other partners. The chooser uses the configured wallet connectors; email,
passkey, and social account sign-in are not configured.
Orbs includes light and dark themes based on the Orbs website. The frontend uses the
existing `playground` Liquidity Hub integration and external Spot partner.
Developer mode, docs links, GitHub links, and developer pages are available only
on `default`; `devMode=true` has no effect on other partners.

Chain selectors use the [Swap](https://docs.orbs.com/liquidity-hub/shared#supported-chains)
and [Advanced Orders](https://docs.orbs.com/advanced-orders/shared#supported-chains)
network lists, excluding Fantom and Polygon zkEVM: 8 swap networks and 23 order
networks. Wallet configuration covers their 24-network union. Order creation requires
a valid partner/chain configuration returned by the Spot SDK.

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

The manual GitHub Actions workflow `.github/workflows/frontend-deploy.yml`
deploys `default` or `orbs` to Vercel. Select `all` to deploy both.

Required repository/environment secrets:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `NEXT_PUBLIC_PROJECT_ID`
- `RPC_URL`

Required repository/environment variables for the default and Orbs deployments:

- `VERCEL_PROJECT_ID_DEFAULT` (read as `vars.VERCEL_PROJECT_ID_DEFAULT`)
- `VERCEL_PROJECT_ID_ORBS` (read as `vars.VERCEL_PROJECT_ID_ORBS`)

## Production and developer boundaries

Trading components live in `components/advanced-order`, `features/swap`, and `features/order-history`. Wallet UI lives in `features/wallet-connection`. Execution logic is isolated from React in `lib/spot` and `lib/swap`; server request validation lives in `lib/server`.

Developer inspectors and simulations live in `features/developer-tools`, with copyable example generators in its `snippets` directory. Import their UI only through `@developer-tools`. Next.js resolves that entry (and `@developer-inspector`) to an empty module for every non-default partner, so developer implementations are excluded from partner builds. ESLint enforces the production import boundary. The default frontend keeps the developer tools available.

Before release, run `yarn lint`, `yarn typecheck`, `yarn test`, and the target partner build. CI runs those checks for pull requests. Wallet execution tests use simulated ports; they do not submit live transactions. Production hosting should enforce request rate limits for the public RPC endpoints and provide `RPC_URL` and `NEXT_PUBLIC_PROJECT_ID` through its environment configuration.

Dependency security overrides in `package.json` keep Axios, viem's WebSocket client, Protobuf, browser mapping data, and MetaMask's UUID utility on patched releases. Remove these overrides when upstream dependency ranges include the fixes. MetaMask uses the compatible UUID v4 API; its override retains CommonJS support.

The October 1, 2026 production dependency audit reports no known vulnerabilities. WalletConnect is on 2.25.0, within wagmi’s supported range; its dependency chain removes the vulnerable legacy URL decoder. Re-run `yarn audit --groups dependencies` before release.

## Spot SDK history endpoints

Spot SDK 2.1.18 provides `getv1orders: false` to restrict order-sink history reads to `https://order-sink-v2.orbs.network`. Both history views and the developer example pass this option, replacing the local patch required by 2.1.17.

Account, chain, and exchange filters are preserved. Submission and legacy subgraph behavior are unchanged; `legacyOrders` controls subgraph reads separately, and the developer example disables those too. Orders available only from the old order-sink host are excluded. The endpoint regression tests cover both ESM and CommonJS builds, including a v2 failure without a fallback request.
