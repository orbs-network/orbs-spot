# Spot integration example

Use this repository to add Spot swaps, TWAP, limit, stop-loss, or take-profit orders to an app.
It uses `@orbs-network/spot-ui` 2.2.9 with the app’s own wallet and UI.

## Start here

1. Read [the example guide](examples/spot/README.md), then choose [swaps](examples/spot/spot-swap.ts) or [advanced orders](examples/spot/advanced-orders.ts).
2. Adapt that flow to your app’s wallet, tokens, chain, and Spot partner. Reuse your existing services.
3. Validate the integration with the checks below and the browser demo.

**For coding agents:** [AGENTS.md](AGENTS.md) identifies the source files, SDK instructions, and checks.
If you are using this repo as a reference for another app, follow [examples/spot/AGENTS.md](examples/spot/AGENTS.md).

## The SDK flow

The swap form accepts an input amount or a receive target. Output entry calls
`client.getQuote({ inToken, outToken, outAmount, user, slippage })` for the same pair.
Review the returned `quote.request.inAmount` as the fixed spend before wallet actions.
Before quoting, automatic slippage uses `getSwapSlippage` with the typed amount's USD value.
Selecting tokens starts cached USD-price queries before an amount is entered; quoting reuses those prices.
The app owns this cache; each standalone SDK price call makes a fresh cancellable request.
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

For the app’s detailed valuation and background-submission behavior, see
[reference integration details](docs/integration-details.md).

## Run and verify

Requires Node 22.23.1 and Yarn 1.22.22 (also recorded in `package.json`).

```bash
yarn install --frozen-lockfile
yarn dev
```

Open [the developer playground](http://localhost:3000/dev). Select a pair, enter an amount,
and choose **Demo** to step through the integration without signing or submitting.
Use `/dev?tab=twap` for advanced orders and `/dev/orders?mockorders=true` for sample history.
WalletConnect setup and deployment are described in [playground operations](docs/playground.md).

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
