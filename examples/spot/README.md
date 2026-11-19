# Add Spot to your app

Choose one browser example:

| You need | Read | Call |
| --- | --- | --- |
| Swaps from an input amount or receive target | [spot-swap.ts](spot-swap.ts) | `swapFlow(account, input)` |
| TWAP, limit, stop-loss, take-profit | [advanced-orders.ts](advanced-orders.ts) | `createAdvancedOrderFlow(account, input, formParams)` |

These files use the public SDK and viem directly. They have no React, Zustand, or playground imports.
They are browser integration references: importing a file initializes the wallet provider, and calling
its exported flow can request real wallet transactions. Run the playground’s **Demo** to explore without trading.

The examples read `window` at module scope. In an app that renders on the server, load the copied
module from a browser event handler with `await import(...)`. When integrating into an existing
wallet stack, replace that setup with your connected wallet clients.

## Adapt the example

1. Install `@orbs-network/spot-ui`, `viem`, and `bignumber.js` (the swap example uses it for USD validation).
2. Copy the chosen file into your app. Replace its chain, Spot partner, and wallet provider with your existing configuration. Retrieve the account from your connected wallet. Cache the Spot client per partner and chain.
3. Use your token registry for addresses, decimals, and the chain’s wrapped-native token. SDK token amounts are integer strings in base units; slippage `0.5` means 0.5%.
4. Connect the inputs below, then call the flow from your reviewed submit action. Recheck wallet/account, balances, and allowance after asynchronous wallet steps. Confirm receipts before proceeding.
5. Keep the accepted order in host state and reconcile it in history if submission or tracking becomes uncertain. The app implementations linked below show persistent activity and guards.

For **swaps**, obtain the reviewed quote through `client.getQuote({ inToken, outToken, inAmount, user: account, slippage })`.
When the user enters a receive target, supply `outAmount` instead of `inAmount`:

```ts
const quote = await client.getQuote({
  inToken, outToken, outAmount: outputAmountRaw, user: account, slippage, signal,
});
```

Keep the actual token pair unchanged. The SDK returns the required spend as
`quote.request.inAmount` and retains the target as `quote.requestedOutAmount`.
Display that spend, the estimated `quote.netAmountOut`, and the protected minimum before calling the flow.
After review, refresh the resolved fixed input rather than recalculating the receive target.

Resolve slippage before requesting either quote. The playground starts token-level `useQuery` reads
when the input and output tokens are selected, even with an empty amount and before a Spot client is ready.
Their cache key contains only chain ID and lowercase ERC-20 token address, with a 30-second freshness window
and no polling interval. Native input uses the configured wrapped-token address.
Quoting reuses the selected token's fresh cached price or an in-flight lookup instead of making an amount-specific price request.
In automatic mode, read the typed side's
unit price with standalone `getTokenUsd({ tokenAddress, chainId, signal })`,
calculate the full USD total using token decimals and decimal arithmetic,
then call `getSwapSlippage({ amountUsd, slippage: baseline })`. Use its `slippagePercent`
in the quote request. The playground waits up to 1.5 seconds for pricing and passes `undefined`
for `amountUsd` after a failure or timeout; caller cancellation still stops quoting.
Pricing uses the SDK's production service independently of the selected order backend.
Each SDK call makes a fresh cancellable request; the playground owns the shared price cache.
Custom mode skips both pricing and the helper, using the user's percentage unchanged. Direct wrap/unwrap also skips price queries.
Keep `quote.request.slippage` through review, preparation, and refreshes; the quote minimum already includes it.
Preparation converts that reviewed percentage to basis points in signed `witness.slippage`
and preserves the quoted minimum unchanged in `witness.output.limit`.

Pass the wrapped ERC-20 input address for native input. Implement `pauseQuotes` and `resumeQuotes`
using your quote lifecycle. `reviewChangedQuote` must display the new output and minimum and resolve
true only when the user accepts them. Pass an `AbortSignal` tied to this attempt.
The flow confirms wrapping/approval, prepares and signs, submits once, and polls for a completed fill.

For **advanced orders**, pass your current form inputs and a quote for the full input amount as `formParams`.
The exported `savedFormParams` is an inspector snapshot for reference. Use `OrderType.TWAP`, `LIMIT`, `STOP_LOSS`, or `TAKE_PROFIT`.
Let `calculateOrder` supply defaults, derived amounts, validation, and schedules; gate on `form.canSubmit`.
The flow returns an accepted order. Refresh history to show later fills.

## Preserve these contracts

- Use `client.spenderAddress` for approvals. These examples approve max uint256 only when allowance is below the input amount; verify allowance against that input after confirmation. Native input must be wrapped before signing.
- Preparation can refresh quotes older than 20 seconds. Display and validate `prepared.quote`; ask for review if output or minimum worsens. Sign its minimum unchanged.
- Sign the returned typed data and submit the exact prepared order with the original hex signature.
- Submission establishes acceptance. Only `OrderStatus.Completed` establishes completion. IDs are not transaction hashes; explorer links use actual fill hashes.
- Serialize wallet actions, retain confirmed wraps, and stop stale attempts when wallet or inputs change. Never automatically repeat a submission or execute a fallback after an uncertain response.

## Go deeper only when needed

| Need | Reference implementation |
| --- | --- |
| Swap attempt guards, wallet checks, wrap reuse | [swap executor](../../lib/swap/execution.ts) |
| Advanced-order wallet port and progress | [order executor](../../lib/spot/execution.ts) |
| Serial, bounded status polling | [settlement](../../lib/swap/settlement.ts) |
| Persist accepted swaps across reloads | [activity](../../lib/swap/activity.ts) |
| Shared client/history queries | [queries](../../lib/spot/queries.ts) |
| Token USD-price cache | [prices](../../lib/spot/prices.ts) |
| Cancellation through the host wallet | [cancellation](../../lib/spot/cancellation.ts) |

For an agent adapting this example, follow [AGENTS.md](AGENTS.md).
For SDK API details, read the integration skill bundled with your installed SDK version.

## Maintain this repository’s examples

Keep these `.ts` examples aligned with the playground downloads in
`features/developer-tools/snippets/sdk-flow-examples.ts`. `yarn typecheck` checks the
standalone files against the installed public SDK.
