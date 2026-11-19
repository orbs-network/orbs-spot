# Reference app integration details

For the shortest path to adding Spot, start with [the example guide](../examples/spot/README.md).
This document explains the reference app’s state, history, valuation, and background submissions.

## Where to start

| Responsibility | Source |
| --- | --- |
| Shared Spot quote identity and display units | [`lib/hooks/use-trade.ts`](../lib/hooks/use-trade.ts) |
| Automatic slippage before quoting | [`lib/swap/slippage.ts`](../lib/swap/slippage.ts) |
| Token USD-price query and cache | [`lib/spot/prices.ts`](../lib/spot/prices.ts) |
| Swap signing, submission and settlement | [`lib/swap/execution.ts`](../lib/swap/execution.ts) |
| Accepted swap activity and reload recovery | [`lib/swap/activity.ts`](../lib/swap/activity.ts), [`features/swap/activity.tsx`](../features/swap/activity.tsx) |
| Advanced-order wallet port and submission sequence | [`lib/spot/execution.ts`](../lib/spot/execution.ts) |
| Confirmed cancellation through the SDK | [`lib/spot/cancellation.ts`](../lib/spot/cancellation.ts) |
| History display mapping and token units | [`lib/spot/history.ts`](../lib/spot/history.ts) |
| Editable form input type | [`lib/spot/form.ts`](../lib/spot/form.ts) |
| Host inputs → `calculateOrder` | [`components/advanced-order/use-order-form.ts`](../components/advanced-order/use-order-form.ts) |
| Cached SDK client, history polling, cancellation | [`components/advanced-order/use-order-client.ts`](../components/advanced-order/use-order-client.ts) |
| Host wallet adapter | [`components/advanced-order/hooks.tsx`](../components/advanced-order/hooks.tsx) |
| Submission action and review/progress state | [`components/advanced-order/use-order-execution.ts`](../components/advanced-order/use-order-execution.ts) |
| Shared order and swap steps, loaders and outcomes | [`components/submission-status.tsx`](../components/submission-status.tsx) |
| Copyable standalone TypeScript flows | [`features/developer-tools/snippets/sdk-flow-examples.ts`](../features/developer-tools/snippets/sdk-flow-examples.ts) |

The execution and cancellation modules do not import React, wagmi, or a UI store. Reuse them with your
own wallet adapter, or follow the SDK calls directly. The app hooks connect these calls to the host's
state and controls. `SubmitOrder` calls `useOrderExecution` once and passes that result to the modal;
its `view` field controls presentation without changing the SDK form or executor status.

The host uses `useMutation` for submission, cancellation, wallet writes and developer actions.
`useQuery` owns configuration, history, balances, allowances and quotes. Reads needed during
execution use `queryClient.fetchQuery`; allowance checks always reread chain state, and confirmed
receipts are cached by chain and transaction hash. Successful writes invalidate the affected wallet's queries.

### Integration flow

1. Reuse `createClient(partner, chainId, { apiUrl })` through your host cache. Include partner, chain, and API URL in its key;
   leave configuration failures retryable. An enabled Orbs partner is required.
2. Map editable inputs, balances, token decimals, USD prices and the current raw output quote into
   `calculateOrder`. Its result owns defaults, validation, trade counts, prices and schedules.
   Advanced-order forms use the cached `client.getQuote` for the complete input amount and pass its raw `quote.netAmountOut`
   unchanged as `quotedOutputAmountRaw`. The swap form also supports quoting a receive target with `outAmount`.
   Dollar estimates use the quote's `inputAmountUsd`,
   `netAmountOutUsd`, and `minimumAmountOutUsd` independently. Pass the input total into
   `calculateOrder` as `inputAmountUsd` and derive token unit prices for advanced-order output valuation.
   Input USD determines minimum-trade validation; quote-derived unit prices value edited limit/trigger
   output amounts. Missing input USD leaves submission disabled without substituting output USD.
   Token lists and direct
   wrap/unwrap flows display token amounts without separate USD-price requests.
   Missing or failed quotes leave the market reference unavailable. Input changes request a fresh quote.
3. Adapt your wallet to `SpotWalletPort`. Transaction writes must resolve after successful receipts,
   and `assertContext` must verify the connected account and chain before wallet actions.
4. Create one `createOrderExecutor(onChange)` per form. Submit its reviewed snapshot with the SDK client,
   wallet adapter, account and tokens. It wraps native input, approves maximum uint256 allowance if needed,
   verifies allowance, prepares immediately before signing, and forwards the original signature unchanged.
5. Use `getOrders({ swapper: account, exchange: partner, apiUrl, getv1orders: false, signal })` for history from the selected service
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
  account,
});
const signature = await wallet.signOrder(prepared.signingRequest);
const order = await client.submitOrder(prepared.order, signature);
```

### Swap quotes, minimum output and settlement

The host selects a trusted API URL from the page query: `api=dev` uses
`https://order-sink-dev.orbs.network`, `api=v1` uses `https://order-sink.orbs.network`, and
`api=v2` explicitly selects `https://order-sink-v2.orbs.network`.
An absent, empty, or unrecognized `api` value uses production v2 without enabling implicit debug mode.
All three recognized values also enable debug partner testing, including the partner selector,
supported-network filtering, and the Partner column in history. Explicit `debug=true` still
enables those features on the default service. Navigation retains the API and partner without
injecting `debug=true`, so clearing the API selection disables implicit debug mode. Developer
inspectors and demos remain restricted to `/dev`.
The SDK receives this URL explicitly through `createClient(..., { apiUrl })` and standalone
history reads; it does not inspect the page query.
Only order submission, status, and history use that selected backend. Configuration and
`client.getQuote` always use `https://order-sink-v2.orbs.network`, independently of `apiUrl`.
Cancellation uses the protocol configuration loaded from production v2. Client and attempt
cache keys and retained swap activity include the order backend, and execution guards reject a destination change after review.
Internal links preserve API selection; developer inspectors and generated code show the effective URL.
USD token pricing remains on the production pricing service, independent of API selection.

TWAP, limit, stop-loss and take-profit forms use an exact-input `client.getQuote` for their
market reference. Advanced-order limit and trigger settings continue to determine their target output.
The swap form accepts either an input amount or a receive target. Editing the receive amount calls
`client.getQuote` with `outAmount` in output-token base units and the actual token pair unchanged.
The server resolves the required input into `quote.request.inAmount`; `quote.requestedOutAmount`
retains the entered target. The typed side stays editable while the opposite amount comes from that quote.
Changing amount side, target, pair, wallet, chain, or slippage uses a separate quote identity and withholds stale values.
Balances, allowance, wrapping, review, and submission use the returned input amount at full precision.
After review, refreshes quote that fixed spend rather than recalculating the target or increasing spending.

Automatic swap slippage is resolved before the quote request. Selecting the input and output
tokens starts independent token-level `useQuery` price reads, including when the amount is empty
and before a Spot client is initialized. Price identity is `chainId` plus the lowercase ERC-20
address, independent of the amount, input/output side, account, or Spot partner. Each query uses
standalone `getTokenUsd({ tokenAddress, chainId, signal })`. The SDK makes a fresh cancellable
request on every call; TanStack Query owns the shared 30-second freshness window and in-flight
reuse, with no polling interval. Custom slippage and direct wrap/unwrap skip these reads.
The slippage query uses `queryClient.fetchQuery` for that same token key, reusing fresh data
or the existing in-flight request. Cancelling an amount draft stops its wait without cancelling
the shared price lookup. The host computes the full trade value with decimal arithmetic:
raw amount divided by `10 ** tokenDecimals`, multiplied by USD per whole token.
For native input, pricing uses the configured wrapped-token address. Output entry uses the output
target token and its decimals. The host passes this total to the synchronous
`getSwapSlippage({ amountUsd, slippage: baseline })` helper. Positive totals worth $100 or less
use at least 1%; larger totals retain the baseline. The price wait is bounded to 1,500 ms;
failed or timed-out lookups use `amountUsd: undefined` and retain the baseline, while caller cancellation
propagates. Custom slippage bypasses pricing and the helper and is sent unchanged.
Pricing always uses the SDK's production service, independently of the selected order backend.
The quote request and UI use the same resolved percentage; review and execution refreshes retain
`quote.request.slippage`. The helper's valuation is separate from quote USD metadata used for
display and the minimum-trade check. Never derive policy from rounded display values or reapply it to a signed order.

The swap form confirms wrapping and approval to `client.spenderAddress`, then uses
`await client.prepareSwap({ quote, account, signal })`, the wallet's EIP-712 signature and `client.submitSwap`.
Quotes retain their account, chain, token, raw amount and slippage identity. Swap execution pauses
quote refreshes, and a changed or stale quote requires review before signing.

Closing a loading review clears the form for the next swap or order. The original submission
continues with its own progress toast and captured amounts; its result cannot replace a newer review.
Click a submission toast to reopen its captured preview without changing the current draft.
Accepted open orders include cancellation with wallet confirmation; completed orders cannot be cancelled.
Wallet requests are serialized through signing. Signed requests and swap settlement can finish
in the background while another order or swap is prepared and submitted.

`quote.netAmountOut` and `quote.minimumAmountOut` are integer output-token base units.
The UI displays the service-provided `minimumAmountOut` unchanged, and
`await client.prepareSwap({ quote, account, signal })` uses the selected quote’s minimum in the signed order.
Preparation reuses quotes up to 20 seconds old and refreshes older quotes. The host validates
and displays `prepared.quote` before signing; worse output or minimum requires a new review.
Quote slippage remains a percentage; `0.5` means 0.5%. Preparation converts the reviewed percentage
to integer basis points in signed `witness.slippage` (`0.5` becomes `50`) and preserves the quoted
minimum unchanged in `witness.output.limit`. Prepared swaps expire after three minutes.
The quote's net output and raw fee do not provide a USD gas cost.

Submission returns an accepted signed order. Its `order.id` identifies an intent and must never be
used as a transaction hash. The swap remains in progress until the SDK reports `OrderStatus.Completed`.
The host’s polling helpers in `lib/swap/settlement.ts` call `client.getOrder({ orderId, signal })`
serially through the accepted order’s signed deadline plus 60 seconds for indexing.
Cancellation and expiration are terminal outcomes; aborted or unconfirmed
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

