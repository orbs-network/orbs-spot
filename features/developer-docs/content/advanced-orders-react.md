# Advanced Orders · React SDK

Use `@orbs-network/spot-react` to add Advanced Orders to an existing React DEX while keeping its UI, wallet, routing, and modal components. `SpotProvider` manages order state, and `useSpot()` exposes fields, submission, progress, and order history to the host application.

Use the `Partners` value supplied by Orbs, or `Partners.Unknown` by default. If the partner configuration is unavailable, contact [@dTWAPSupportGroup](https://t.me/dTWAPSupportGroup).

This is the host-owned presentation variant: the DEX supplies its modal shell and field components while `spot-react` owns Advanced Orders state. Use `@orbs-network/swap-ui` for the order-creation and progress content, styled or wrapped to match the host.

## Integration Resources

- [Spot React integration skill](https://github.com/orbs-network/spot-ui/tree/master/skills/spot-react-integration) — complete integration guidance for `SpotProvider`, `useSpot()`, wallet adapters, lifecycle, and order history.
- [Advanced Orders provider-shell example](https://github.com/orbs-network/orbs-spot/blob/main/components/advanced-order/spot-provider-shell.tsx) — reference implementation of the host DEX adapter and provider boundary.

## Prerequisites

Advanced Orders extends an existing EVM swap form; it does not replace the DEX wallet, token, balance, pricing, quote, or transaction infrastructure. Before installing the SDK, make sure the host application already provides every capability below.

### Required DEX Capabilities

- `Wallet connection and network` — Expose the connected account, connection status, and active chain ID. Keep connect, disconnect, and network switching in the host shell. Provide wallet and public clients for signatures, contract writes, reads, and transaction receipts. Spot receives `account`, `chainId`, and `walletInteractions`.
- `Token model and native wrapping` — Resolve the selected source and destination tokens on the active chain with address, symbol, decimals, and native-token status. Resolve the wrapped-native token address when native input is supported. Spot receives `srcToken`, `dstToken`, and the wrapped address used by `wrapNativeToken`.
- `Wallet balances` — Read source and destination balances as raw integer base-unit strings. Also expose native gas balance to the host UI. Refetch after account, chain, or token changes and after successful wrapping or order-progress updates. Spot receives `srcBalance` and `dstBalance`.
- `USD prices` — Resolve the current USD value of one whole source and destination token. Preserve loading, unavailable, and stale states in the host adapter; do not present a missing price as confirmed market data. Spot receives `srcUsd1Token` and `dstUsd1Token`, while the host supplies `minChunkSizeUsd`.
- `Market-reference quote` — Produce a destination amount in raw base units for the exact current input, pair, account, and chain. Track the input that produced it, expose loading and no-liquidity states, and clear stale output immediately when any quote input changes. Spot receives `marketReferencePrice.value`, `isLoading`, and `noLiquidity`.
- `Form state and amount conversion` — Own the selected strategy, token selection, decimal input string, reset action, and conversions between display units and raw token units. Spot receives `module` and `typedInputAmount`.
- `Wallet operations` — Wrap native input, read ERC-20 allowance, approve the configured spender, sign EIP-712 data, cancel an order, wait for successful receipts, and surface rejection or revert errors through the five `walletInteractions` methods and lifecycle callbacks.
- `Host UI and lifecycle` — Provide token inputs, network controls, accessible modal and confirmation primitives, notifications, translations, amount formatting, and bounded or virtualized order/fill lists. Keep portals under the provider context and build the UI from `useSpot()` panels.
- `Integration configuration` — Know the supported chains, Orbs partner, price-protection percentage, minimum chunk value, optional fee, and whether the DEX or SDK owns query parameters. Pass `partner`, `priceProtection`, `minChunkSizeUsd`, `fees`, and `enableQueryParams` explicitly.

### Readiness Test

Before mounting `SpotProvider` in production, confirm this flow on every supported chain:

1. Connect and disconnect a wallet, switch networks, and verify that account-scoped state resets cleanly.
2. Select either token direction and resolve token metadata, raw balances, native gas balance, and current USD prices.
3. Enter and edit an amount; each completed quote must belong to the latest amount, pair, account, and chain.
4. Complete wrap, allowance, approval, typed-data signing, and receipt handling with both success and wallet-rejection paths.
5. Refresh balances and order history after successful lifecycle events without replacing the DEX form state while a modal is open.

If any item is missing, implement it in the host DEX first. The SDK should receive existing DEX state through a thin adapter rather than becoming a second wallet, pricing, or quote store.

## Install the React SDK

Install the React SDK with the package manager already used by the host application.

```bash
npm install @orbs-network/spot-react@latest @orbs-network/swap-ui@latest
```

React and React DOM are also peer dependencies; reuse the compatible versions already installed by the host. Keep the wallet library, dialog shell, token input, formatting, and virtualization components the DEX already uses. Import package APIs only from `@orbs-network/spot-react` or `@orbs-network/swap-ui`, never from internal `dist/*` paths.

## Advanced Orders Provider

The interactive example keeps the provider boundary in the `provider.tsx` tab and the reusable host adapters in `hooks.ts`. Alias the package export `SpotProvider` as `AdvancedOrdersProvider` so its purpose is explicit inside the host application.

The Hooks tab includes the complete optional Wagmi/Viem `useWalletInteractions` adapter, stable `marketReferencePrice`, and lifecycle callbacks. `useAdvancedOrdersCallbacks()` reads the refresh action from the host balance hook, so the provider does not pass balance state into it. Other wallet stacks can implement the same five operations. Transaction methods must wait for a successful receipt, throw when a transaction reverts, and then return its hash. Return the original `0x`-prefixed signature from `signOrder`; do not split or rewrite it.

Approve `maxUint256` in the React adapter even though Spot passes an `amount` to `approveToken`. Advanced Orders, especially TWAP, may pull multiple chunks over time; an exact per-call approval can allow the first fill and break later fills. Surface wallet rejection for wrap, approval, cancellation, and signing through the host notification system, then rethrow the original error so Spot can update its execution state.

The larger bounded example lets developers inspect both files without making the page unbounded. Scroll inside the code area or use Full Screen when comparing it with the host application.

Provider fields:

| Field | Source and meaning |
| --- | --- |
| `partner` | Use the `Partners` value supplied by Orbs, or `Partners.Unknown` when none was supplied. |
| `module` | Active strategy selected by host navigation: TWAP, Limit, Stop Loss, or Take Profit. |
| `typedInputAmount` | User-facing decimal source amount from the existing DEX form. |
| `priceProtection` | Host-configured Advanced Orders price-protection percentage; `3` means 3%. |
| `minChunkSizeUsd` | Host-configured minimum USD value for one execution chunk, passed through `getMinChunkSizeUsd`. |
| `marketReferencePrice.value` | Current quoted destination amount as a raw base-unit string. |
| `marketReferencePrice.isLoading` | Whether the host DEX is loading the market-reference quote. |
| `marketReferencePrice.noLiquidity` | Whether the completed host quote found no liquidity. |
| `walletInteractions` | Stable adapters for wrap, approve, cancel, sign, and allowance reads. |
| `chainId`, `account` | Chain ID and account from the connected wallet. |
| `srcToken`, `dstToken` | Source and destination token metadata adapted from the host token model. |
| `srcBalance`, `dstBalance` | Wallet balances as raw integer strings in token base units. |
| `srcUsd1Token`, `dstUsd1Token` | USD value of one whole source or destination token. |
| `fees` | Optional Advanced Orders fee percentage supplied by the Orbs partner configuration. |
| `enableQueryParams` | Set `false` when the host owns URL state such as `?order=twap`; this prevents the SDK and host from competing for query parameters. |
| `callbacks` | Stable lifecycle callbacks; balance refreshes run only after wrapping and order-progress updates. |

Pass `priceProtection` and `minChunkSizeUsd` from the host integration configuration instead of copying sample constants. `priceProtection` is a percentage (`3` means 3%), not swap slippage. The public `getMinChunkSizeUsd(configuredValue)` helper preserves the package's supported URL-query override; it does not discover a minimum from the server, so the host must still supply the configured USD value. Pass `fees={0}` explicitly when the partner configuration defines no Advanced Orders fee; otherwise pass the agreed percentage.

Use the connected wallet chain as the UI source of truth. Keep wallet connection and network selection in the host application's existing shell; this form only blocks submission and explains the missing state.

The SDK fetches and shares the trusted RePermit configuration internally. Do not fetch `/config`, construct local contract configuration, or validate a second copy in the DEX.

## Build the Form with useSpot

Keep the form visible while the wallet is disconnected. Each focused child component should call `useSpot()` for the panel it renders; do not pass the complete hook result through the component tree.

```tsx
import { Module, ORBS_TWAP_FAQ_URL, useSpot } from "@orbs-network/spot-react";

export function AdvancedOrderFields() {
  // Read only the provider state needed to choose module-specific fields.
  const { module } = useSpot();
  const showTrigger =
    module === Module.STOP_LOSS || module === Module.TAKE_PROFIT;

  return (
    <form className="dex-swap-form" onSubmit={(event) => event.preventDefault()}>
      <TokenInputs />
      <PriceHeader />
      {/* Trigger fields exist only for strategies that can wait for a price. */}
      {showTrigger ? <TriggerPriceField /> : null}
      <LimitPriceField alwaysOn={module === Module.LIMIT} />
      {module === Module.TWAP ? <TradesAmountField /> : null}
      {module === Module.TWAP ? <FillDelayField /> : <DurationField />}
      <ValidationAndDisclaimer />
      <SubmitOrderSection />
    </form>
  );
}

function PriceHeader() {
  const panel = useSpot().pricePanel;
  return (
    <PriceSummary
      fromToken={panel.fromToken} toToken={panel.toToken}
      inverted={panel.isInverted} marketOrder={panel.isMarketPrice}
      onInvert={panel.onInvert}
    />
  );
}

function TradesAmountField() {
  const panel = useSpot().tradesAmountPanel;
  return (
    <NumberInput
      label="Trades" value={String(panel.totalTrades)} max={panel.maxTrades}
      onValueChange={(value) => panel.onChange(Number(value))}
      helper={`${panel.amountPerTradeUI} ${panel.fromToken?.symbol} per trade`}
      error={panel.error ? t(panel.error.type, panel.error.args) : undefined}
    />
  );
}

function TimeField({ kind }: { kind: "duration" | "fillDelay" }) {
  const spot = useSpot();
  const panel = kind === "duration" ? spot.durationPanel : spot.fillDelayPanel;
  const value = kind === "duration" ? spot.durationPanel.duration : spot.fillDelayPanel.fillDelay;
  return (
    <TimeInput
      label={kind === "duration" ? "Duration" : "Time between trades"}
      value={String(value.value)} unit={value.unit}
      onValueChange={panel.onInputChange} onUnitChange={panel.onUnitSelect}
      error={panel.error ? t(panel.error.type, panel.error.args) : undefined}
    />
  );
}

const DurationField = () => <TimeField kind="duration" />;
const FillDelayField = () => <TimeField kind="fillDelay" />;

function LimitPriceField({ alwaysOn }: { alwaysOn: boolean }) {
  const panel = useSpot().limitPricePanel;
  if (!alwaysOn && !panel.isLimitPrice) {
    return <Button type="button" onClick={panel.toggleLimitPrice}>Add limit price</Button>;
  }
  return (
    <PriceInput
      label="Limit price" value={panel.priceUI} percentage={panel.percentage}
      loading={panel.isLoading} onValueChange={panel.onInputChange}
      onPercentageChange={panel.onPercentageChange} onReset={panel.onReset}
      error={panel.error ? t(panel.error.type) : undefined}
    />
  );
}

function TriggerPriceField() {
  const panel = useSpot().triggerPricePanel;
  return (
    <PriceInput
      label="Trigger price" value={panel.priceUI} percentage={panel.percentage}
      loading={panel.isLoading} onValueChange={panel.onInputChange}
      onPercentageChange={panel.onPercentageChange} onReset={panel.onReset}
      helper={`${panel.amountPerChunkUI} ${panel.srcToken?.symbol} per execution`}
      error={panel.error ? t(panel.error.type) : undefined}
    />
  );
}

function TokenInputs() {
  const dex = useDexSpotAdapter();
  // Spot calculates the output panel from the same DEX input and quote state.
  const output = useSpot().dstTokenPanel;

  return (
    <>
      <CurrencyInput
        label="From"
        token={dex.srcToken}
        value={dex.typedInputAmount}
        onValueChange={dex.setTypedInputAmount}
      />
      <CurrencyInput
        label="To"
        token={dex.dstToken}
        value={output.value}
        loading={output.isLoading}
        disabled
      />
    </>
  );
}

function ValidationAndDisclaimer() {
  // Keep SDK validation and legal copy inside the DEX's visual components.
  const spot = useSpot();

  return (
    <>
      {spot.inputError ? (
        <InlineError>
          {t(spot.inputError.type, spot.inputError.args)}
        </InlineError>
      ) : null}
      {spot.disclaimerPanel ? (
        <Notice>
          {t(spot.disclaimerPanel)}{" "}
          <a href={ORBS_TWAP_FAQ_URL} target="_blank" rel="noreferrer">
            Learn more
          </a>
        </Notice>
      ) : null}
    </>
  );
}
```

| Panel | TWAP | LIMIT | STOP LOSS | TAKE PROFIT |
| --- | --- | --- | --- | --- |
| Trades amount | Yes | — | — | — |
| Fill delay | Yes | — | — | — |
| Duration | — | Yes | Yes | Yes |
| Limit price | Optional | Always on | Optional | Optional |
| Trigger price | — | — | Yes | Yes |

Translate `inputError.type` and `disclaimerPanel` keys through the DEX i18n system. Convert raw integer amount fields into the DEX native amount type before displaying them. Network changes must use the DEX network control, not the Spot token selector.

## Submit Modal and Lifecycle

Use `submitOrderButton` for configuration and validation state, `derivedFormData` for the review, and `orderExecutionPanel` for submission and progress. The review and progress states belong to one DEX modal.

```tsx
import { useState } from "react";
import { DISCLAIMER_URL, useSpot } from "@orbs-network/spot-react";

export function SubmitOrderSection() {
  const { account, chainId, setTypedInputAmount } = useDexSpotAdapter();
  // These panels separate button readiness, review data, and execution progress.
  const { submitOrderButton: submit, orderExecutionPanel: execution, derivedFormData: review, supportedChains } = useSpot();
  const [isOpen, setIsOpen] = useState(false);
  const [accepted, setAccepted] = useState(false);

  function closeModal() {
    setIsOpen(false);
  }

  function onExitComplete() {
    // Run cleanup from the host modal's real exit-complete lifecycle.
    setAccepted(false);
    if (execution.isSuccess) {
      setTypedInputAmount("");
      execution.resetState(); // Success starts a completely new form.
    } else if (execution.status) execution.resetCurrentSwap(); // Keep DEX input for retry.
  }

  // Wallet and network controls stay in the host shell, outside this form.
  if (!account) return <InlineError>Connect a wallet using the host wallet control.</InlineError>;
  if (!chainId || !supportedChains.includes(chainId))
    return <InlineError>Switch to a supported network using the host network control.</InlineError>;

  return (
    <>
      <Button
        type="button"
        onClick={() => submit.error ? void submit.retry() : setIsOpen(true)}
        disabled={submit.error ? submit.loading : submit.disabled}
        loading={submit.loading}
      >
        {submit.error ? "Retry order configuration"
          : submit.loading ? "Loading configuration…" : "Review order"}
      </Button>

      <Dialog
        open={isOpen}
        onOpenChange={(open) => open ? setIsOpen(true) : closeModal()}
        onExitComplete={onExitComplete}
      >
        <DialogContent className="max-h-[min(720px,90dvh)] overflow-y-auto overscroll-contain">
          {/* Once execution starts, progress replaces every review action. */}
          {!execution.status ? (
            <>
              <DialogTitle>Review {review.orderType} order</DialogTitle>
              <TokenAmounts
                srcToken={execution.srcToken} dstToken={execution.dstToken}
                srcAmount={review.srcAmountUI} dstAmount={review.dstAmountUI}
                srcUsd={review.srcAmountUsd} dstUsd={review.dstAmountUsd}
              />
              <OrderReview
                deadline={review.deadline} totalTrades={review.totalTrades}
                tradeSize={review.sizePerTradeUI} tradeInterval={review.tradeInterval}
                minReceived={review.minDestAmountPerTradeUI}
                triggerPrice={review.triggerPriceUI} limitPrice={review.limitPriceUI}
                feeAmount={review.feesAmountUI} feePercent={review.feesPercentage}
              />
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={accepted}
                  onChange={(event) => setAccepted(event.target.checked)} />
                Accept the <a href={DISCLAIMER_URL} target="_blank" rel="noreferrer">
                  Advanced Orders disclaimer
                </a>
              </label>
              <Button type="button" onClick={closeModal}>Keep editing</Button>
              {/* Disclaimer acceptance gates the only order-creation action. */}
              <Button
                type="button" onClick={() => void execution.onSubmit()}
                disabled={!accepted || !!execution.confirmButtonLoading}
                loading={!!execution.confirmButtonLoading}
              >
                Create order
              </Button>
            </>
          ) : (
            <OrderProgress
              aria-live="polite" status={execution.status} step={execution.step}
              stepIndex={execution.stepIndex} totalSteps={execution.totalSteps}
              srcToken={execution.srcToken} dstToken={execution.dstToken}
              srcAmount={review.srcAmountUI} dstAmount={review.dstAmountUI}
              wrapTxHash={execution.wrapTxHash} approveTxHash={execution.approveTxHash}
              error={execution.parsedError}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
```

`Dialog` is a host application component. Build `OrderReview` and `OrderProgress` on `@orbs-network/swap-ui` so wrap, approve, create, success, and failure states from `orderExecutionPanel` remain aligned with the supported execution model. Map `onExitComplete` to the host modal's animation-finished callback (or run it immediately when the modal has no exit animation).

Once `execution.status` is set, progress owns the modal: hide the review, confirm button, duplicate title, and footer actions. On close, clear the DEX input and call `resetState()` only after success. After failure or wallet rejection, keep the input and call `resetCurrentSwap()` so the user can retry.

Keep provider callbacks stable and refresh balances only from `onWrapSuccess` and `onOrdersProgressUpdate`. When wrapping succeeds, queue the wrapped input-token address but keep the native token visible while the submit modal is open. Apply the queued address only after the modal exit completes, then clear the queue. This avoids mutating the source token underneath the active execution view.

Wire the callback surface the product actually exposes: request/success/failure notifications for wrap, approval, signing, submission, and cancellation; `onOrderFilled`; `onOrdersProgressUpdate`; and `onCopy`. Keep order creation silent only when the modal already presents the same success state. Every callback should either perform a named host action or be deliberately omitted—do not publish a provider example full of no-op callbacks.

## Order History

Build history from `orderHistoryPanel`, derive display fields with `useDerivedHistoryOrder()`, and cancel open orders with `useCancelOrder()`. Keep the complete modal under the provider or render it through a context-preserving portal.

```tsx
import { useMemo, useState } from "react";
import {
  OrderFilter,
  OrderStatus,
  useCancelOrder,
  useDerivedHistoryOrder,
  useSpot,
  type Order,
} from "@orbs-network/spot-react";

export function AdvancedOrderHistory() {
  const history = useSpot().orderHistoryPanel;
  const [filter, setFilter] = useState<OrderFilter>(OrderFilter.All);
  // Store only the ID so details always resolve the latest live order object.
  const [selectedOrderId, setSelectedOrderId] = useState<string>();
  const getOrders = (value: OrderFilter) =>
    history.orders[value.toLowerCase() as keyof typeof history.orders];
  const visibleOrders = getOrders(filter);
  const selectedOrder = useMemo(
    () => history.orders.all.find((order) => order.id === selectedOrderId),
    [history.orders.all, selectedOrderId],
  );

  return (
    <Dialog>
      <DialogTrigger>Order history ({history.orders.all.length})</DialogTrigger>
      <DialogContent className="max-h-[min(760px,90dvh)] overflow-y-auto overscroll-contain">
        {selectedOrder ? (
          <OrderDetails
            order={selectedOrder}
            onBack={() => setSelectedOrderId(undefined)}
          />
        ) : (
          <>
            <DialogTitle>Advanced Orders history</DialogTitle>
            <Select
              aria-label="Filter orders by status"
              value={filter}
              onValueChange={(value) => setFilter(value as OrderFilter)}
              items={Object.values(OrderFilter).map((value) => ({
                value,
                label: `${value} (${getOrders(value).length})`,
              }))}
            />
            {history.isLoading ? <OrdersSkeleton /> : null}
            {!history.isLoading && visibleOrders.length === 0 ? (
              <EmptyState>No {filter} orders yet.</EmptyState>
            ) : null}
            {/* Keep the current SDK snapshot bounded and cheap to render. */}
            <VirtualizedList
              items={visibleOrders}
              getKey={(order: Order) => order.id}
              renderItem={(order: Order) => (
                <OrderRow order={order} onSelect={setSelectedOrderId} />
              )}
            />
            <Button
              type="button"
              onClick={() => void history.refetchOrders()}
              loading={history.isRefetching}
            >
              Refresh orders
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function OrderRow({
  order,
  onSelect,
}: {
  order: Order;
  onSelect: (id: string) => void;
}) {
  const srcToken = useDexSpotToken(order.srcTokenAddress);
  const dstToken = useDexSpotToken(order.dstTokenAddress);
  // The hook combines raw SDK order data with DEX token metadata for display.
  const derived = useDerivedHistoryOrder(order, srcToken, dstToken);

  if (!derived) return null;

  return (
    <button
      type="button"
      aria-label={`Open ${derived.orderType} order ${order.id}`}
      onClick={() => onSelect(order.id)}
    >
      <span>{derived.orderType}</span>
      <span>{derived.srcAmountUI} {derived.srcToken?.symbol}</span>
      <span>{derived.progress}% · {order.status}</span>
    </button>
  );
}

function OrderDetails({ order, onBack }: { order: Order; onBack: () => void }) {
  const srcToken = useDexSpotToken(order.srcTokenAddress);
  const dstToken = useDexSpotToken(order.dstTokenAddress);
  const derived = useDerivedHistoryOrder(order, srcToken, dstToken);

  if (!derived) return null;

  return (
    <section>
      <Button type="button" onClick={onBack}>Back to orders</Button>
      <h2>{derived.orderType} order</h2>
      <ExecutionSummary
        status={order.status}
        progress={derived.progress}
        amountInFilled={derived.amountInFilledUI}
        amountOutFilled={derived.amountOutFilledUI}
        executionPrice={derived.executionPriceUI}
      />
      <OrderInfo
        orderId={derived.id}
        createdAt={derived.createdAt}
        deadline={derived.deadline}
        tradeSize={derived.sizePerTradeUI}
        totalTrades={derived.totalTrades}
        tradeInterval={derived.tradeInterval}
        minReceived={derived.minDestAmountPerTradeUI}
        triggerPrice={derived.triggerPriceUI}
        limitPrice={derived.limitPriceUI}
        recipient={derived.recipient}
      />
      <VirtualizedFillsList fills={derived.fills} />
      <CancelOrderButton order={order} />
    </section>
  );
}

function CancelOrderButton({ order }: { order: Order }) {
  const cancellation = useCancelOrder(order);
  const { refetchOrders } = useSpot().orderHistoryPanel;
  const [isConfirming, setIsConfirming] = useState(false);

  async function confirmCancellation() {
    const hash = await cancellation.cancelOrder();
    if (!hash) return;
    await refetchOrders();
    setIsConfirming(false);
  }

  // Completed and terminal orders must never expose an on-chain cancel action.
  if (order.status !== OrderStatus.Open) return null;

  return (
    <>
      <Button
        type="button" disabled={cancellation.disabled}
        onClick={() => setIsConfirming(true)}
      >
        Cancel order
      </Button>
      <ConfirmationDialog
        open={isConfirming}
        title="Cancel this order?"
        description="Cancellation is an on-chain transaction and requires a wallet confirmation."
        error={cancellation.error}
        confirmLabel={cancellation.isLoading ? "Cancelling…" : "Confirm cancellation"}
        confirmDisabled={cancellation.isLoading}
        onCancel={() => setIsConfirming(false)}
        onConfirm={() => void confirmCancellation()}
      />
    </>
  );
}
```

Store the selected order ID, then look up the current order from `orders.all` so an open details view receives live progress updates. Virtualize both the order rows and fill rows with the DEX's existing list library. The current SDK exposes one filtered snapshot rather than an infinite list, but the viewport should still stay bounded. Show a confirmation and failure state for open-order cancellation, then refetch after the transaction succeeds. Do not expose internal Order Sink URLs in the customer-facing modal.

### Package Guardrails and Escape Hatches

- Import from the package roots only. Internal `dist/*` paths are not public API and may change without notice.
- Do not wrap Spot in a second application Error Boundary. `spot-react` ships its own boundary; surface adapter failures by throwing and using callbacks.
- Prefer `SpotProvider` and `useSpot()` for the supported integration. The exported `useRePermitData`, `useSignOrder`, `useSubmitOrder`, and `useSwapExecution` hooks are escape hatches for advanced host orchestration, not replacements for the provider lifecycle.
- Set `enableQueryParams={false}` when the DEX owns module/query navigation.
- Render “Powered by Orbs” attribution when required by the partner integration agreement.
- Keep modals and portals under the provider context, including their exit-complete cleanup.

## Integration Checklist

| Check | Action | Expected result | If it fails |
| --- | --- | --- | --- |
| Provider | Pass host tokens, decimal input, raw balances, one-token USD prices, memoized non-stale quote state, wallet chain, partner, explicit fee, callbacks, and `enableQueryParams={false}` when the host owns URL state. | `AdvancedOrdersProvider` renders without duplicating DEX state or query parameters. | Compare the provider field table with the host adapter and fix the mismatched unit or source. |
| Wallet | Implement all 5 interactions with the host wallet stack, approve `maxUint256`, handle user rejection, and wait for successful receipts. | Wrap, approve, cancel, sign, and allowance reads use the connected account and chain. | Notify, rethrow, and let Spot show the failed execution step. |
| Form | Render the module-specific panels from `useSpot()` with host-native components. | TWAP, Limit, Stop Loss, and Take Profit show only their applicable controls. | Compare the panel visibility table and translated validation keys. |
| Submit | Retry configuration errors, review `derivedFormData`, and replace review with progress after submission starts. | Wrap, approve, create, success, and failure appear in one bounded modal. | Keep review closed until configuration recovers. |
| Lifecycle | Reset after the modal exit completes; clear DEX input only on success; apply a queued wrapped-token swap only after close. | Failed or rejected attempts retain input for retry and the modal never changes token mid-flow. | Move cleanup and wrapped-token application to the host modal's actual exit callback. |
| Callbacks | Refetch balances only on wrap success and orders-progress updates; wire request, success, failure, fill, cancellation, and copy feedback. | Balance refreshes are stable and every user-visible lifecycle has feedback. | Check memoization and callback ownership. |
| History | Render every `OrderFilter`, live details, virtualized rows/fills, confirmation, cancellation failure, and success refetch under provider scope. | Open orders update in place and terminal orders cannot cancel. | Verify portal context, selected ID lookup, and post-cancel refetch. |

Ready to launch when every row passes on each supported chain.

Reference the source package when upgrading:

- [Spot React package](https://github.com/orbs-network/spot-ui/tree/master/packages/spot-react)
- [Reference React integration](https://github.com/orbs-network/orbs-spot/blob/main/components/advanced-order/spot-provider-shell.tsx)
