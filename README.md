# Orbs Spot — TypeScript SDK Example

A working reference integration for swap quotes, swaps, and advanced orders using `@orbs-network/spot-ui`.
The playground uses Next.js/React for its UI, wagmi/viem for its wallet, Zustand for editable state,
and TanStack Query for reads and async actions. Spot calculation and execution use the framework-neutral SDK directly;
there is no `@orbs-network/spot-react` dependency or Spot provider.

- [Playground](https://spot-app.orbs.com/)
- [Integration documentation](https://docs.orbs.com/)
- [SDK integration skill](https://github.com/orbs-network/spot-ui/tree/master/skills/spot-integration)

## Where to start

| Responsibility | Source |
| --- | --- |
| Shared Spot quote identity and display units | [`lib/hooks/use-trade.ts`](lib/hooks/use-trade.ts) |
| Swap signing, submission and settlement | [`lib/swap/execution.ts`](lib/swap/execution.ts) |
| Accepted swap activity and reload recovery | [`lib/swap/activity.ts`](lib/swap/activity.ts), [`features/swap/activity.tsx`](features/swap/activity.tsx) |
| Advanced-order wallet port and submission sequence | [`lib/spot/execution.ts`](lib/spot/execution.ts) |
| Confirmed cancellation through the SDK | [`lib/spot/cancellation.ts`](lib/spot/cancellation.ts) |
| History display mapping and token units | [`lib/spot/history.ts`](lib/spot/history.ts) |
| Editable form input type | [`lib/spot/form.ts`](lib/spot/form.ts) |
| Host inputs → `calculateOrder` | [`components/advanced-order/use-order-form.ts`](components/advanced-order/use-order-form.ts) |
| Cached SDK client, history polling, cancellation | [`components/advanced-order/use-order-client.ts`](components/advanced-order/use-order-client.ts) |
| Host wallet adapter | [`components/advanced-order/hooks.tsx`](components/advanced-order/hooks.tsx) |
| Submission action and review/progress state | [`components/advanced-order/use-order-execution.ts`](components/advanced-order/use-order-execution.ts) |
| Shared order and swap steps, loaders and outcomes | [`components/submission-status.tsx`](components/submission-status.tsx) |
| Copyable standalone TypeScript flows | [`features/developer-tools/snippets/sdk-flow-examples.ts`](features/developer-tools/snippets/sdk-flow-examples.ts) |

The execution and cancellation modules do not import React, wagmi, or a UI store. Reuse them with your
own wallet adapter, or follow the SDK calls directly. The app hooks connect these calls to the host's
state and controls. `SubmitOrder` calls `useOrderExecution` once and passes that result to the modal;
its `view` field controls presentation without changing the SDK form or executor status.

The host uses `useMutation` for submission, cancellation, wallet writes and developer actions.
`useQuery` owns configuration, history, balances, allowances, quotes and prices. Reads needed during
execution use `queryClient.fetchQuery`; allowance checks always reread chain state, and confirmed
receipts are cached by chain and transaction hash. Successful writes invalidate the affected wallet's queries.

### Integration flow

1. Reuse `createClient(partner, chainId)` through your host cache. Include both partner and chain in its key;
   leave configuration failures retryable. An enabled Orbs partner is required.
2. Map editable inputs, balances, token decimals, USD prices and the current raw output quote into
   `calculateOrder`. Its result owns defaults, validation, trade counts, prices and schedules.
   Every form uses the cached `client.getQuote` for the complete input amount and passes its raw `quote.netAmountOut`
   unchanged as `quotedOutputAmountRaw`. USD prices supply dollar estimates and minimum-trade validation.
   Missing or failed quotes leave the market reference unavailable. Input changes request a fresh quote.
3. Adapt your wallet to `SpotWalletPort`. Transaction writes must resolve after successful receipts,
   and `assertContext` must verify the connected account and chain before wallet actions.
4. Create one `createOrderExecutor(onChange)` per form. Submit its reviewed snapshot with the SDK client,
   wallet adapter, account and tokens. It wraps native input, approves the exact raw amount if needed,
   verifies allowance, prepares immediately before signing, and forwards the original signature unchanged.
5. Use `getOrders({ swapper: account, exchange: partner, getv1orders: false, signal })` for V2 history
   and `order.historyKey` for row/cache identity. The host cache adds token metadata for display.
6. Cancel using `client.getCancelOrderRequest(order)` and a confirmed wallet write, then refetch history.
   The app refreshes while history is open and pauses polling in background tabs.
   Fill notifications and post-fill balance updates follow those reads or explicit refreshes;
   advanced orders are refreshed through history. Accepted swaps also have a bounded background tracker.

Submission is never automatically retried. After a network failure during submission, check history
before attempting another order. After a confirmed wrap, returning to review selects the wrapped token
and retains the amount, prices and schedule. Selecting native input again always requires a new wrap.

The essential SDK submission calls are below. Run them only after form validation and any required
wrapping/approval have completed; the executor adds wallet checks and progress reporting around them.

```ts
const prepared = client.prepareOrder({
  form,
  inputTokenAddress,
  outputTokenAddress,
  swapperAddress: account,
});
const signature = await wallet.signOrder(prepared.signingRequest);
const order = await client.submitOrder(prepared.order, signature);
```

### Swap quotes, minimum output and settlement

Swap, TWAP, limit, stop-loss and take-profit forms share an exact-input `client.getQuote` for their
market reference. Advanced-order limit and trigger settings continue to determine their target output.
The swap form confirms wrapping and approval to `client.spenderAddress`, then uses
`client.prepareSwap`, the wallet's EIP-712 signature and `client.submitOrder`.
Quotes retain their account, chain, token, raw amount and slippage identity. Swap execution pauses
quote refreshes, and a changed or stale quote requires review before signing.

Closing a loading review clears the form for the next swap or order. The original submission
continues with its own progress toast and captured amounts; its result cannot replace a newer review.
Wallet requests are serialized through signing. Signed requests and swap settlement can finish
in the background while another order or swap is prepared and submitted.

`quote.netAmountOut` and `minimumOutputAmountRaw` are integer output-token base units.
`getMinimumOutputAmount(quote.netAmountOut, slippage)` floors the protected minimum with the same
rounded basis-point conversion as quoting; `0.5` means 0.5%. For example, a net quote of `1000000`
base units produces a `995000` minimum at 0.5%. The UI minimum is distinct from the swap order's
fixed 5% signed oracle protection. The quote's net output and raw fee do not provide a USD gas cost.

Submission returns an accepted signed order. Its `order.id` identifies an intent and must never be
used as a transaction hash. The swap remains in progress until the SDK reports `OrderStatus.Completed`.
`waitForOrder`/`watchOrder` track the accepted order serially through its signed deadline plus
60 seconds for indexing. Cancellation and expiration are terminal outcomes; aborted or unconfirmed
tracking does not prove the order failed. Check history before submitting another swap after an
uncertain outcome. Never automatically retry submission or execute a fallback.

Accepted swap snapshots persist in browser activity so tracking can resume after the active flow
stops or the page reloads. Only actual fill transaction hashes produce explorer links. Existing
transaction-based activity remains readable and uses receipt checks, bounded to 24 hours from
submission before an unresolved result becomes unconfirmed. Completed activity is retained for
90 days. Storage failures do not change an accepted order's result.

### Demo mode

For designer previews, open `/dev?tab=twap&mockorders=true` or
`/dev/orders?mockorders=true`. The `/dev` route and `mockorders=true` are required
to enable sample open and historical orders. No wallet is required. The sample
data includes multiple networks, order types, fill activity, and terminal statuses;
search, filters, and details use the existing UI. A shared history hook appends
samples to the fetched wallet orders without adding them to the wallet cache.
Sample orders cannot be cancelled. Remove the parameter to show only real orders.

Open `/dev?tab=twap` and choose **Demo** to inspect calculation, signing, and submission stages
without sending wallet transactions. **Place order** uses the connected wallet. Limit, stop-loss and take-profit
forms use the same SDK calculation and execution path.

## Verification

```bash
yarn typecheck
yarn lint
node --experimental-transform-types --test scripts/*.test.mjs
yarn build
```

## Development

Run from the repository root:

```bash
yarn install --frozen-lockfile
yarn dev
```

The app runs on [http://localhost:3000](http://localhost:3000).

Orbs is the only frontend. Use `yarn dev`, `yarn build`, and `yarn start`;
branding is fixed and does not use a partner environment variable.

Orbs uses the standard RainbowKit wallet picker. The custom chooser is disabled
by `features.customConnectModal` in `lib/partners/orbs.ts`. The picker uses the
configured wallet connectors; email, passkey, and social account sign-in are not configured.
Orbs includes light and dark themes based on the Orbs website. The frontend uses the
`external` partner for Spot swaps and advanced orders.
Developer tools are available only inside `/dev`. The main trading UI
keeps its normal review and execution flow, including with `debug=true`.
The debug flag enables partner testing without exposing developer controls,
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
Internal navigation preserves the debug selection. Without exactly `debug=true`,
the URL override is ignored and the `external` integration partner is used.
Orders also show a Partner column in debug mode, using the partner retained
with each fetched order.
The selected Spot partner also applies to swaps;
developer tools stay inside `/dev`, even when `debug=true` is passed.
In debug mode, the network picker lists only chains supported by the selected
partner. An incompatible connected network shows **Wrong network**, and the
order action offers a switch to a compatible network.

Swap and advanced-order forms share the same 23 supported networks and partner filtering,
excluding Fantom and Polygon zkEVM. Wallets and public clients also retain Blast for legacy swap activity.
See the [Spot integration guide](https://github.com/orbs-network/spot-ui/tree/master/skills/spot-integration)
for quoting and capability checks. Swap and advanced-order creation require a valid partner/chain
configuration returned by the Spot SDK.

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
[`scripts/deploy.sh`](scripts/deploy.sh). It always targets production on
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
a failed build. `RPC_URL` and `NEXT_PUBLIC_*` values are also
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

Before release, run `yarn lint`, `yarn typecheck`, `node --test scripts/*.test.mjs`, and `yarn build`. Production hosting should enforce request rate limits for the public RPC endpoints and provide `RPC_URL` and `NEXT_PUBLIC_PROJECT_ID` through its environment configuration.

Dependency security overrides in `package.json` keep Axios, viem's WebSocket client, Protobuf, browser mapping data, and MetaMask's UUID utility on patched releases. Remove these overrides when upstream dependency ranges include the fixes. MetaMask uses the compatible UUID v4 API; its override retains CommonJS support.

The October 1, 2026 production dependency audit reports no known vulnerabilities. WalletConnect is on 2.25.0, within wagmi’s supported range; its dependency chain removes the vulnerable legacy URL decoder. Re-run `yarn audit --groups dependencies` before release.

## Spot SDK history endpoints

Spot SDK 2.1.18 provides `getv1orders: false` to restrict order-sink history reads to `https://order-sink-v2.orbs.network`. Both history views and the developer example pass this option, replacing the local patch required by 2.1.17.

Account, chain, and exchange filters are preserved. Submission and legacy subgraph behavior are unchanged; `legacyOrders` controls subgraph reads separately, and the developer example disables those too. Orders available only from the old order-sink host are excluded. The endpoint regression tests cover both ESM and CommonJS builds, including a v2 failure without a fallback request.
