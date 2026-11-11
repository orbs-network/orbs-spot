# Spot integration example

Use this repository to add Spot swaps, TWAP, limit, stop-loss, or take-profit orders to an app.
It uses `@orbs-network/spot-ui` 2.2.0 with the app’s own wallet and UI.

## Start here

1. Read [the example guide](examples/spot/README.md), then choose [swaps](examples/spot/spot-swap.ts) or [advanced orders](examples/spot/advanced-orders.ts).
2. Adapt that flow to your app’s wallet, tokens, chain, and Spot partner. Reuse your existing services.
3. Validate the integration with the checks below and the browser demo.

**For coding agents:** [AGENTS.md](AGENTS.md) identifies the source files, SDK instructions, and checks.
If you are using this repo as a reference for another app, follow [examples/spot/AGENTS.md](examples/spot/AGENTS.md).

## The SDK flow

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
yarn test       # Regression tests and generated-example consistency
yarn typecheck  # Includes the standalone TypeScript examples
yarn lint
yarn build
```

The examples and playground downloads share one generator. After editing it, run
`yarn examples:generate`; `yarn examples:check` detects stale examples without changing files.

SDK instructions matching the installed version are bundled at
`node_modules/@orbs-network/spot-ui/dist/integration-skill/SKILL.md`.
See also the [SDK repository guide](https://github.com/orbs-network/spot-ui/tree/master/skills/spot-integration),
[integration documentation](https://docs.orbs.com/), and [live playground](https://spot-app.orbs.com/).
