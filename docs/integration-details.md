# Reference app integration details

For the shortest path to adding Spot, start with [the example guide](../examples/spot/README.md).
This document explains the reference app’s state, history, valuation, and background submissions.

## Where to start

| Responsibility | Source |
| --- | --- |
| Shared Spot quote identity and display units | [`lib/hooks/use-trade.ts`](../lib/hooks/use-trade.ts) |
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

1. Reuse `createClient(partner, chainId)` through your host cache. Include both partner and chain in its key;
   leave configuration failures retryable. An enabled Orbs partner is required.
2. Map editable inputs, balances, token decimals, USD prices and the current raw output quote into
   `calculateOrder`. Its result owns defaults, validation, trade counts, prices and schedules.
   Every form uses the cached `client.getQuote` for the complete input amount and passes its raw `quote.netAmountOut`
   unchanged as `quotedOutputAmountRaw`. Dollar estimates use the quote's `inputAmountUsd`,
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
  account,
});
const signature = await wallet.signOrder(prepared.signingRequest);
const order = await client.submitOrder(prepared.order, signature);
```

### Swap quotes, minimum output and settlement

Swap, TWAP, limit, stop-loss and take-profit forms share an exact-input `client.getQuote` for their
market reference. Advanced-order limit and trigger settings continue to determine their target output.
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
Quote slippage remains a percentage; `0.5` means 0.5%. This minimum is distinct from the swap order's
fixed 5% signed oracle protection. Prepared swaps expire after three minutes.
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

