# Advanced Orders · Direct API

Use this guide when the application should integrate Advanced Orders without installing an Orbs package. The host application owns the interface, wallet integration, request flow, and order lifecycle while calling the Order Sink APIs directly.

This path has no Orbs package dependency and works with any frontend or backend stack. The HTTP and EIP-712 contract is canonical.

## Concepts

| Term | Meaning |
| --- | --- |
| Order Sink | Off-chain service that accepts signed RePermit orders and exposes them through the orders API. |
| RePermit | On-chain contract used for token authorization and cancellation. Users approve this contract to spend the source token. |
| Reactor | Contract encoded as the signed permit `spender`. It is part of the signed order and is not the ERC-20 allowance spender. |
| Swapper | User address that owns the order. This must be the EIP-712 signer and is stored at `order.witness.swapper`. |
| RePermit digest | Order cancellation digest returned by Order Sink as `metadata.repermitDigest`. This is passed to the RePermit `cancel(bytes32[])` function. |

### Integration Sequence

1. Create an order by fetching trusted configuration, preparing funds, building and signing the order, and submitting it to Order Sink.
2. Fetch orders from Order Sink for the swapper, chain ID, and adapter.
3. Cancel an order on-chain when needed.

## Integration Resources

- [UI](https://orbs-spot.vercel.app/?tab=twap)
- [Direct integration reference](https://github.com/orbs-network/spot-integration-docs)

### Function Contracts

This document describes the behavior of three functions. Your implementation can be in Java, Python, TypeScript, Go, or any other stack.

The optional full-flow TypeScript example uses Wagmi v3 and Viem for wallet interactions. The same protocol steps can be implemented with another wallet or backend stack.

`fetchRePermitData(partner, chainId)` fetches the server-controlled EIP-712 domain, types, primary type, and order template for one partner and chain.

`buildRePermitOrderData(...)` builds the EIP-712 payload the user signs. It returns:

| Field | Purpose |
| --- | --- |
| `domain` | EIP-712 domain returned by the config API. Pass it through unchanged. |
| `types` | EIP-712 type definitions returned by the config API. Pass them through unchanged. |
| `primaryType` | EIP-712 primary type returned by the config API. Currently `"RePermitWitnessTransferFrom"`. |
| `order` | The message the user signs and the same order object later sent to Order Sink. |

`submitOrder(signature, order)` sends the signed order to Order Sink as `{ signature, order, status: "pending" }`. The complete request appears once in the Create Order snippet.

The RePermit contract, reactor, executor, exchange adapter, and fee reference addresses come from the fetched partner configuration. Do not hardcode them in the integration.

## Fetch Partner Config

Use this section as the language-independent HTTP contract. The reference at the top shows the complete `GET /config` request and response; the TypeScript tab is an optional implementation of the same request.

| Operation | Contract |
| --- | --- |
| Fetch configuration | `GET https://order-sink-v2.orbs.network/config?partner={partner}&chain={chainId}` with `Accept: application/json`. |
| Create order | `POST https://order-sink-v2.orbs.network/orders/new` with JSON `{ signature, order, status: "pending" }`. `order` must be the exact EIP-712 message that produced `signature`. |
| Fetch history | `GET https://order-sink-v2.orbs.network/orders?swapper={account}&chainId={chainId}&exchange={adapter}`. The adapter comes from the configuration response. |
| Cancel | Send the on-chain transaction `cancel([metadata.repermitDigest])` to `domain.verifyingContract`; cancellation is not an Order Sink HTTP request. |

`GET /config` returns `domain`, `types`, `primaryType`, and an `order` template. Preserve the domain and types unchanged. Reject the response when `domain.verifyingContract` or `order.witness.exchange.adapter` is missing or the zero address, or when either signed chain ID differs from the connected chain. Encode the partner as a query value and cache a valid response for the lifetime of that partner/chain selection.

## Build the Order

Start with the fetched template and override only integration-owned fields. Spread every nested server object before applying local token, account, amount, timing, and strategy values. This keeps the RePermit contract, reactor, executor, adapter, fee reference, share, adapter data, and exclusivity supplied by the service.

Do not construct a message literal with copied sample addresses. The copyable end-to-end example uses this shape:

```js
const order = {
  ...permitDataResponse.order,
  permitted: {
    ...permitDataResponse.order.permitted,
    token: inputTokenAddress,
    amount: totalInputAmount,
  },
  nonce,
  deadline,
  witness: {
    ...permitDataResponse.order.witness,
    swapper: account,
    nonce,
    start,
    deadline,
    chainid: activeChainId,
    epoch,
    slippage: slippageBps,
    freshness: freshnessSeconds,
    input: {
      ...permitDataResponse.order.witness.input,
      token: inputTokenAddress,
      amount: srcAmountPerFill,
      maxAmount: totalInputAmount,
    },
    output: {
      ...permitDataResponse.order.witness.output,
      token: dstToken,
      limit: dstMinAmountPerFill,
      triggerLower,
      triggerUpper,
      recipient: account,
    },
  },
};
```

Top-level signed fields:

| Signed path | Source and units |
| --- | --- |
| `permitted.token` | Source ERC-20 address from the DEX. Use the wrapped token when the user selected native currency. |
| `permitted.amount` | Maximum total source amount the complete order may spend, as an integer string in source-token base units. This is also the total amount to wrap and the minimum required allowance. |
| `spender` | Copy `permitDataResponse.order.spender`. This is the reactor encoded in the signature, not the ERC-20 allowance spender. |
| `nonce` | Fresh unsigned integer for this permit. The live builder uses the current Unix time in milliseconds and encodes it as a decimal string. |
| `deadline` | Permit expiration as Unix time in seconds, encoded as a decimal string. |

Use plain integer decimal strings for every amount, nonce, and timestamp that is serialized as a string. Do not use scientific notation, decimal points, or locale formatting. `deadline` and `start` are Unix seconds; the sample nonce is Unix milliseconds so it remains distinct from those timestamps.

### Witness Fields

The witness is signed with the token permission. There are no extra order-type, duration, or helper-trigger fields in the EIP-712 message or the `POST /orders/new` body.

| Signed path | Source and units |
| --- | --- |
| `witness.reactor`, `witness.executor` | Copy the corresponding `permitDataResponse.order.witness` fields. |
| `witness.exchange.adapter`, `ref`, `share`, `data` | Copy the complete exchange object from `permitDataResponse`. `share` is a server-configured unsigned integer; do not invent a fee value. |
| `witness.swapper` | Connected account that owns the funds and produces the EIP-712 signature. |
| `witness.nonce` | The same nonce used by the top-level permit, tying the witness to that permission. |
| `witness.start`, `witness.deadline` | Earliest execution and expiration times as Unix seconds. |
| `witness.chainid` | Active EVM chain ID. It must equal `domain.chainId` and the connected wallet chain. |
| `witness.exclusivity` | Copy the server-configured unsigned integer from `permitDataResponse`; do not infer its policy locally. |
| `witness.epoch` | Seconds between eligible fills. For TWAP, derive it from the selected fill interval. |
| `witness.slippage` | Allowed execution slippage in basis points; `100` means 1%. |
| `witness.freshness` | Maximum accepted age of execution price data in seconds. Default to `60` unless Orbs explicitly provides another value. |
| `witness.input.token` | Source ERC-20 address; it must equal `permitted.token`. |
| `witness.input.amount` | Source amount allocated to one fill, in source-token base units. |
| `witness.input.maxAmount` | Maximum total source amount across fills, in source-token base units; normally equal to `permitted.amount`. |
| `witness.output.token` | Destination ERC-20 address. |
| `witness.output.recipient` | Address that receives filled destination tokens, normally the connected account. |

### Output Limit and Trigger Rules

All 3 output strategy fields are destination-token amounts per fill, serialized as plain integer base-unit strings.

| Signed field | Rule |
| --- | --- |
| `witness.output.limit` | Minimum destination amount required per fill. Use `"0"` for market-style execution. |
| `witness.output.triggerLower` | Stop-loss trigger threshold. Set it only for stop-loss orders; otherwise use `"0"`. |
| `witness.output.triggerUpper` | Take-profit trigger threshold. Set it only for take-profit orders; otherwise use `"0"`. |

Only these final fields are signed. Module names and UI helpers are builder inputs, not extra EIP-712 or Order Sink fields.

## Strategy Recipes

All amounts below are integer strings in token base units. Start from the trusted `/config` template, preserve its protocol and exchange fields, and fill only the strategy values. For one-fill strategies use `totalTrades = 1`, `witness.epoch = 0`, and `witness.input.amount = witness.input.maxAmount = permitted.amount`.

| Strategy | Required field rules |
| --- | --- |
| TWAP | Choose `totalTrades > 1`; set `permitted.amount = srcAmountPerFill × totalTrades`, `input.amount = srcAmountPerFill`, `input.maxAmount = permitted.amount`, and `epoch = fillDelaySeconds`. Ensure `deadline >= start + epoch × (totalTrades - 1)`. Set both triggers to `"0"`; set `output.limit` to the minimum destination amount per fill, or `"0"` for market execution. |
| Limit | Use one fill and `epoch = 0`. Set `output.limit` to the required minimum destination amount; both triggers are `"0"`. The order remains eligible until `witness.deadline`. |
| Stop Loss | Use one fill and `epoch = 0`. Set `triggerLower` to the lower trigger amount per fill and `triggerUpper = "0"`. Set `output.limit` to the post-trigger minimum, or `"0"` for market execution. |
| Take Profit | Use one fill and `epoch = 0`. Set `triggerUpper` to the upper trigger amount per fill and `triggerLower = "0"`. Set `output.limit` to the post-trigger minimum, or `"0"` for market execution. |

Build the order close to signing time. The live Spot builder generates one nonce from the current Unix time in milliseconds and uses that same value for both `order.nonce` and `order.witness.nonce`. Preserve the complete built order unchanged through signing, submission, storage, and retry.

## Create Order

The optional Wagmi v3 reference at the top contains the complete package-free flow. The default `create-order-flow.ts` tab reads current swap values from the host's `useDerivedData()` hook, fetches permit data, prepares funds, builds `signTypedDataArgs` inline, signs, and submits. `order-types.ts` contains the shared contracts. Replace the example hook import with the DEX's existing derived swap-data hook.

1. Fetch the trusted partner and active-chain permit template.
2. Check allowance, wrap native input when needed, and approve RePermit for `order.permitted.amount` when allowance is insufficient. This Direct API reference uses an exact allowance; use a maximum allowance only as an explicit host security decision.
3. Build `signTypedDataArgs` inline from the template, connected account, and values returned by `useDerivedData()`, then pass it directly to `walletClient.signTypedData`.
4. Submit `signTypedDataArgs.message` unchanged as `{ signature, order, status: "pending" }` to `POST /orders/new`.
5. Require HTTP and API success, then keep the returned `signedOrder` for progress, history, fills, and cancellation.

Use the partner identifier provided by Orbs. If none was provided, send the exact value `"unknown"`. Token amounts must be integer strings in base units, the signer must match `order.witness.swapper`, and the active chain must match both the EIP-712 domain and witness chain IDs.

Do not recreate the EIP-712 domain, types, protocol contracts, or exchange fields locally. Do not rebuild or mutate the order after signing. Store the returned order hash for tracking and `metadata.repermitDigest` for cancellation.

`POST /orders/new` returns a success envelope containing `signedOrder`, or an API error. Preserve the returned order `hash`, service `metadata`, original `order`, `signature`, and timestamp. Transport success alone is insufficient: also require the response body's `success` value before treating creation as complete.

### `useDerivedData()` Fields

| Field | Meaning |
| --- | --- |
| `inputToken.address` | Selected source-token address from the host DEX. The flow replaces it with `wTokenAddress` after wrapping native input. |
| `dstToken` | ERC-20 destination-token address. |
| `sourceIsNative` | `true` when the user selected native currency and the flow must wrap it before signing. |
| `totalInputAmount` | Complete order input as an integer source-token base-unit string. This becomes `permitted.amount` and `input.maxAmount`. |
| `srcAmountPerFill` | Source amount assigned to one fill, in source-token base units. |
| `dstMinAmountPerFill` | Minimum destination amount accepted for one fill, in destination-token base units. Use `"0"` when the strategy has no limit. |
| `deadlineMillis` | Absolute order deadline as Unix time in milliseconds. The helper converts it to Unix seconds. |
| `fillDelayMillis` | Delay between eligible fills in milliseconds. The helper converts it to `witness.epoch` seconds. |
| `totalTrades` | Number of expected fills. Values of `0` or `1` produce `witness.epoch = 0`. |
| `slippageBps` | Execution slippage in basis points; `100` means 1%. |
| `freshnessSeconds` | Maximum accepted age of execution price data in seconds. Use `60` unless Orbs explicitly supplied another value. |
| `triggerLower` | Lower strategy trigger in destination-token base units. Use `"0"` when unused. |
| `triggerUpper` | Upper strategy trigger in destination-token base units. Use `"0"` when unused. |

### `signTypedDataArgs` Fields

| Field | Meaning |
| --- | --- |
| `account` | Connected wallet that owns the order and must equal `message.witness.swapper`. |
| `domain` | Server-controlled EIP-712 domain returned by default permit data. Its `verifyingContract` is also the ERC-20 allowance spender. |
| `types` | Complete ordered EIP-712 type map returned by default permit data. Pass it to the wallet unchanged. |
| `primaryType` | Root EIP-712 type returned by default permit data. Pass it to the wallet unchanged. |
| `message` | Fully populated RePermit order. Sign this object and submit the exact same object as `order`. |

### Created Order Fields

| Field | Meaning |
| --- | --- |
| `hash` | Order Sink identifier used to track the created order. |
| `order` | Exact RePermit message that was signed and submitted. |
| `signature` | Complete EIP-712 wallet signature submitted with the order. |
| `timestamp` | Creation time assigned by Order Sink. |
| `metadata.status` | Current execution state, initially `"pending"`. |
| `metadata.repermitDigest` | On-chain digest required to cancel the order. Preserve it with the created order. |

## Fetch Order Sink Orders

Fetch RePermit orders from Order Sink with the swapper address, chain ID, and exchange adapter from the fetched template. The `swapper` query value is the order owner address, matching `order.witness.swapper`. The `exchange` query value should be `permitDataResponse.order.witness.exchange.adapter`.

Use the Request and Response tabs in the `Fetch Order History Request` reference. The Request tab contains the complete fetch helper and a copyable cURL request. The Response tab contains the successful `orders` JSON returned by Order Sink.

Important fields for consumers:

| Field | Description |
| --- | --- |
| `hash` | Order Sink order ID/hash. Store this for tracking. |
| `order` | Original signed RePermit order. |
| `metadata.status` | Order Sink status. `"pending"` and `"eligible"` are open states; `"completed"` is filled. |
| `metadata.description` | Additional status description. A cancelled order may be reported as `"cancelled by contract"` after the on-chain cancel is indexed. |
| `metadata.expectedChunks` | Expected number of fills/chunks. |
| `metadata.chunks` | Fill/chunk execution details, when available. |
| `metadata.lastPriceCheck` | Most recent time Order Sink evaluated the order's execution price. |
| `metadata.nextEligibleTime` | Earliest time the next fill may be attempted. |
| `metadata.repermitDigest` | Permit digest required for on-chain cancellation. Store this value. |
| `metadata.displayOnlyInputTokenPriceUSD` | Display-only USD price encoded as an 18-decimal fixed-point integer. Format it before display; never use it for execution math. |
| `signature` | Complete wallet signature authorizing the RePermit order. |
| `timestamp` | Time Order Sink accepted the order. |

The endpoint returns raw Order Sink objects. If you normalize them in your own service, keep the raw `metadata.repermitDigest`; it is needed to cancel the order.

## Cancel Order Sink Orders

Cancelling a RePermit order is an on-chain transaction. Do not send a cancel request to Order Sink. The copyable example at the top resolves the trusted RePermit contract for the active wallet chain, submits `metadata.repermitDigest`, checks the receipt, and then refreshes history.

`orderSinkOrder` is one item from the submitted or fetched Order Sink response. The cancellation digest comes from `orderSinkOrder.metadata.repermitDigest`. Do not use the Order Sink `hash` as the cancel digest. Use the same `permitDataResponse.domain.verifyingContract` that was fetched for the order; retain that address with local order metadata if cancellation may happen later.

Cancellation flow:

1. Fetch the order from `https://order-sink-v2.orbs.network/orders`.
2. Read `metadata.repermitDigest`.
3. Ask the user or custody system to send a transaction to the RePermit contract.
4. Call `cancel([metadata.repermitDigest])`. Use `metadata.repermitDigest`, not the Order Sink `hash`.
5. Wait for the transaction receipt.
6. Refetch the same Order Sink endpoint until metadata reflects the cancelled state.

The transaction sender should be the same address that signed the original order. In the signed order this is `order.witness.swapper`.

## Operational Checklist

| Check | Action | Expected result | If it fails |
| --- | --- | --- | --- |
| Configuration | Fetch `/config` with the Orbs partner value or `"unknown"`; preserve its domain, types, protocol contracts, and exchange fields. | Domain and witness chain IDs equal the connected wallet chain. | Block signing and surface a partner/chain configuration error. |
| Strategy math | Apply the selected recipe with integer base-unit strings and one fresh shared nonce. | Total amount, per-fill amount, epoch, deadline, limit, and triggers satisfy the recipe invariants. | Keep review disabled and identify the invalid field. |
| Funding | Read allowance for signer → `domain.verifyingContract`; wrap native input and approve the complete amount when required. | Both receipts succeed and allowance covers `permitted.amount`. | Keep the order unsubmitted; show the reverted preparation step. |
| Signature | Set `witness.swapper` to the signer and sign the final message once. | The exact signed message is retained unchanged. | Discard the signature and rebuild from current state. |
| Submission | POST `{ signature, order, status: "pending" }` and require HTTP success plus `result.success`. | A `signedOrder` with hash and metadata is stored. | Show the API error without silently marking creation successful. |
| History | Fetch orders using the stored chain and adapter. | The UI receives the matching orders and keeps raw metadata. | Offer retry and preserve the last known list. |
| Cancellation | Resolve RePermit for the active wallet chain, call `cancel([metadata.repermitDigest])`, confirm the receipt, then refetch. | Order Sink eventually reports the terminal cancelled state. | Show the on-chain failure and leave the order open. |

Ready to launch when every row passes on each supported chain.
