# Review: `@orbs-network/spot-react` → `@orbs-network/spot-ui` (TypeScript SDK)

**Date:** 2026-09-16
**Scope:** 39 modified files, 6 new files (uncommitted working tree on `main`)
**Reviewer:** Claude Opus 5

## Verification

| Check | Result |
| --- | --- |
| `yarn typecheck` | pass |
| `yarn lint` | pass |
| `yarn test` | pass — 52/52 |
| `grep spot-react` over source | no code references remain |

The only surviving `spot-react` mentions are in `docs-integration-review.md`, which is a review *of* the
upstream docs and legitimately names the old package.

## Verdict

**The migration looks good and the result is understandable.** The layering is the right one, the React
adapters are thin, and the provider removal fixed several real correctness problems rather than just
relocating code.

## What the new structure looks like

| Layer | Files | Notes |
| --- | --- | --- |
| Framework-neutral SDK usage | `lib/spot/{execution,cancellation,history,form}.ts` | No React, wagmi, or store imports. Portable to another host. |
| React adapters | `components/advanced-order/use-order-{client,form,execution}.ts` | One responsibility each. |
| Wallet adapter | `components/advanced-order/hooks.tsx` | Implements `SpotWalletPort` over wagmi. |

`<SpotProvider>` and its 75-line `spot-provider-shell.tsx` were replaced by a plain `useMemo` +
`OrderFormContext`. That is a genuine simplification: the shell existed mostly to prop-drill host values
into the provider.

## Correctness improvements gained in the move

- **`assertContext` before every wallet step.** The wallet account and chain are re-read from the wallet
  client before each critical action, so a mid-flow account or network switch aborts instead of signing
  against stale render state.
- **Bounded allowance re-read after approval** (4 attempts, 500 ms apart) instead of assuming the write
  took effect. A lagging RPC read no longer triggers a duplicate approval transaction.
- **Wrap idempotency across retries.** `completedWrap` is keyed by chain/account/token, so a retry after a
  rejection wraps only the shortfall rather than depositing the same funds twice.
- **`structuredClone(input.form)` before the first `await`.** Form edits cannot mutate an in-flight order.
  Verified safe: `CalculatedOrderForm` is plain data with no functions.
- **`historyKey` replaces `order.id`** for row identity, selection state, Virtuoso keys, and structural
  sharing. This closes a latent v1/v2 protocol ID collision.
- **Shared `queryOptions` between `useQuery` and `fetchQuery`** (allowance, transaction receipts), so
  rendered state and execution reads cannot disagree or double-fetch.
- **Ambiguous-submission handling.** A lost HTTP response after `submitOrder` surfaces a "check history
  before retrying" message instead of presenting as a clean failure, and `retry: false` is set throughout.
- **`signal` threading** into balances, USD prices, and order history so TanStack Query can cancel reads.

Confirmed no behavior regression from dropping the `legacyOrders` argument: it defaults to `true` in the
installed SDK, so legacy v1 orders still load. The README dev-port change (3007 → 3000) is also correct —
nothing in the repo overrides `next dev`'s default port.

## Findings

Ordered by how much they matter. None of these block the migration.

### 1. Stray `true` in the orders query key

`components/advanced-order/use-order-client.ts:56`

```ts
queryKey: ["spot-orders", partner, chainId, address?.toLowerCase(), true],
```

Leftover from a version that passed `legacyOrders` explicitly; `getAccountOrders({ account, signal })` no
longer takes it. Harmless in practice — the invalidations in `useCancelOrder` and `useExecution` match by
prefix — but it directly contradicts the comment two lines above ("Every request-defining value belongs in
the key"). Drop it.

### 2. Fill notifications only fire while the history panel is open

`useOrders` sets `refetchInterval: open ? 10_000 : false`, and `useHistoryNotifications` rides that same
query. "Order filled" toasts and the post-fill balance refresh therefore only land while the panel is
visible. This may be a deliberate request-saving choice, but it narrows behavior versus the provider's
polling. **Worth confirming intent.**

### 3. `useCalculatedOrder` now runs while the form is hidden

`components/advanced-order-form.tsx:20`

Moving `if (hidden) return null` below the hook call is the *correct* fix for the conditional-hook
violation that existed before. The side effect is that the order form's balance, USD-price, and quote
subscriptions stay live while the user is on the Swap tab. Those queries are shared with the swap form, so
this is probably free — worth one look at the network tab to confirm.

### 4. `ensureAllowance` throws after the RPC read

`lib/hooks/use-approval.ts:22`

The `if (!amount) throw new Error("Missing required allowance amount")` guard sits inside `.then()`, so it
burns a contract read before failing. Move it above the fetch.

### 5. Silent no-op submit

`components/advanced-order/use-order-execution.ts:64`

When a guard fails, the mutation function returns `undefined` with no toast. `useSubmitButton` disables the
button for most of these conditions, but `executor.isBusy()` is not among them, so a click can land and do
nothing visible.

### 6. Redundant balance refetches

`components/advanced-order/use-order-client.ts:116`

`refetchBalances()` is called inside the per-order loop — once per changed order rather than once total.

### 7. One type escape added

`components/advanced-order/hooks.tsx:160`

```ts
message: request.typedData.message as any,
```

Acceptable given viem's typed-data generics; `Record<string, unknown>` would likely satisfy it without the
`any`.

## Notes, not findings

- `describeOrder` renders `ui: ""` when token decimals are unavailable rather than guessing an 18-decimal
  conversion. Correct choice — just make sure the UI shows a placeholder instead of an empty cell.
- The module-scope `createOrderExecutor` singleton in `use-order-execution.ts` is safe here: `trading-form.tsx`
  mounts exactly one `AdvancedOrderForm`. The comment already documents the multi-form caveat.
- `useLimitPrice().toggle` is a no-op under `Module.LIMIT` (the calculation forces `isMarketOrder: false`),
  but `price-panels.tsx` hides the switch for that module, so the UI is consistent.
- `memo` on `AdvancedOrderContent` is a real optimization here: when the calculated model changes, only
  context consumers re-render, not the whole subtree.

## Follow-up: findings checked and addressed

**Date:** 2026-09-16

| Finding | Resolution |
| --- | --- |
| 1. Extra `true` in the history key | Removed. The key now matches the partner, chain and account used by the request. The installed SDK still supports the optional `legacyOrders` argument; omitting it retains its default legacy-order behavior. |
| 2. Notifications follow visible-history polling | Kept intentionally, consistent with the existing README. Added an explicit explanation in the hook and README: notifications follow history reads and explicit refreshes; there is no continuous background monitor. |
| 3. Hidden advanced form subscriptions | `TradingForm` now mounts `AdvancedOrderForm` only on advanced-order tabs. Hooks remain unconditional within the mounted component, and the store retains the draft across tab switches. |
| 4. Missing amount checked after RPC | `ensureAllowance` now rejects before starting its execution-time allowance read. |
| 5. Silent submission guards | Guards now reject with actionable preflight messages, shown by the mutation's error handler. The shared execution state also disables submit buttons while an order is running. Executor failures retain their existing detailed progress/error UI. |
| 6. Repeated balance refreshes | Collect fill changes across the history update and refresh balances once, while preserving per-order completion notifications. |
| 7. Signing `any` cast | Removed the cast and file-wide lint suppression. A shallow copy of the typed message satisfies the host's record type without changing signed fields or values. |

The note about missing token decimals revealed one additional display issue: unknown amounts were
formatted as zero. History now shows `-` for missing amounts, while an actual `"0"` remains zero.

Validation: typecheck and lint pass; **59/59 tests pass**, including seven new regressions for the
reviewed behavior. Browser verification confirms draft preservation across Swap/TWAP switches and
successful completion of the simulated order flow without sending transactions.
