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
| Copyable standalone TypeScript flows | [`components/developer-tools/sdk-flow-examples.ts`](components/developer-tools/sdk-flow-examples.ts) |

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
deploys `default`, `crymbo`, `efficient-frontier`, `ginco`, `ht-digital`, or `all` to Vercel.

Required repository/environment secrets:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID_DEFAULT` or fallback `VERCEL_PROJECT_ID`
- `VERCEL_PROJECT_ID_CRYMBO`
- `VERCEL_PROJECT_ID_EFFICIENT_FRONTIER`
- `VERCEL_PROJECT_ID_GINCO`
- `VERCEL_PROJECT_ID_HT_DIGITAL`
- `NEXT_PUBLIC_PROJECT_ID`
- `RPC_URL`
