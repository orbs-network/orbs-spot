# Liquidity Hub Integration

This guide is for teams that want to add Orbs Liquidity Hub to an existing DEX, swap application, or trading service without adopting a specific UI framework.

Liquidity Hub is an optimization layer. Request its quote during the existing DEX quote cycle, then enter this execution guide after the host application selects Liquidity Hub.

## Concepts

| Term | Meaning |
| --- | --- |
| Liquidity Hub | Orbs optimization layer that requests liquidity from on-chain and off-chain solvers. It is used only when it improves the user's executable result. |
| Permit2 | Token permission contract that receives ERC-20 allowance for Liquidity Hub swaps. The current address is `0x000000000022D473030F116dDEE9F6B43aC78BA3`. |
| Quote signing data | `quote.permitData` contains the raw Permit2 domain, types, and values. Normalize it with ethers `_TypedDataEncoder` before passing the resulting payload to the wallet. Advanced Orders does not require this Liquidity Hub-specific normalization step. |
| Partner | Partner name supplied by Orbs. If Orbs has not supplied one, use `"unknown"`. |
| Session ID | Quote session identifier returned by Liquidity Hub and carried through swap submission and status polling. |

### Integration Sequence

1. Create one Liquidity Hub SDK client for the active chain.
2. Request a Liquidity Hub quote alongside the existing DEX quote.
3. Wrap a native source asset when required.
4. Approve Permit2 to spend the ERC-20 source token.
5. Pause quote polling, refresh only when needed, normalize and sign the permit data, and submit the swap.
6. Confirm the on-chain receipt and request Liquidity Hub transaction details.
7. Report the successful Liquidity Hub route—or a successful DEX fallback—through SDK analytics.

## Integration Resources

- [UI](https://orbs-spot.vercel.app)
- [Integration Skill](https://github.com/orbs-network/spot-ui/tree/master/skills/liquidity-hub-integration)
- [Liquidity Hub example](https://github.com/orbs-network/orbs-spot/blob/main/components/best-trade-form.tsx) — Liquidity-Hub-only example; use the dual-route algorithm in this guide when the host also has a DEX quote.

## Install and Initialize

Install the plain JavaScript SDK, Viem, and the ethers typed-data encoder used to normalize Liquidity Hub signing payloads. None requires React:

```bash
npm install @orbs-network/liquidity-hub-sdk @ethersproject/hash viem
```

Create one Liquidity Hub client for the active chain and reuse it for quote and swap operations. Create a new client when the active chain changes; do not create a new client for every quote.

```js
import { constructSDK } from "@orbs-network/liquidity-hub-sdk";

const partner = "unknown"; // Replace with the partner name supplied by Orbs.

function createLiquidityHubClient(chainId) {
  return constructSDK({
    chainId,
    partner,
    blockAnalytics: false,
  });
}

let liquidityHub = createLiquidityHubClient(137);

function changeChain(nextChainId) {
  liquidityHub = createLiquidityHubClient(nextChainId);
}
```

Use the `partner` name supplied by Orbs. If Orbs has not supplied one, use the lowercase string `"unknown"`.

Keep analytics enabled in production. Set `blockAnalytics: true` only in automated tests or a privacy mode agreed with Orbs; disabling it prevents quote and execution feedback from reaching the service.

The protocol examples use Viem directly. Reuse the host application's existing `PublicClient` and `WalletClient` for the active chain. The optional interactive panels access those clients through Wagmi v3.

Supported networks in the current SDK integration guide:

| Chain ID | Network |
| --- | --- |
| `1` | Ethereum |
| `14` | Flare |
| `56` | BNB Chain |
| `137` | Polygon |
| `146` | Sonic |
| `250` | Fantom |
| `1101` | Polygon zkEVM |
| `8453` | Base |
| `42161` | Arbitrum |
| `59144` | Linea |
| `81457` | Blast |

Before enabling a chain, confirm that the integrating application has the correct wrapped-native-token address and can send and confirm transactions on that chain.

## Request Quotes

Quote request fields:

| Field | Required | Meaning |
| --- | --- | --- |
| `fromToken` | Yes | ERC-20 source token address. Use the wrapped token address when the user selected a native asset. |
| `toToken` | Yes | Destination token address. |
| `inAmount` | Yes | Source amount as an integer base-unit string. |
| `dexMinAmountOut` | No, recommended | Current DEX route's slippage-adjusted executable minimum output, in destination-token base units. Pass `"-1"` when no DEX quote exists or both requests must start together; omission and the sentinel are not equivalent to the service. |
| `account` | Required for execution | User address that will sign and own the swap. |
| `slippage` | Yes | Percentage tolerance, such as `0.5` for 0.5%. |
| `signal` | No | `AbortSignal` used to cancel an obsolete quote request. |
| `timeout` | No | Quote timeout override in milliseconds. The SDK default is 10 seconds. |
| `inAmountUsd` | No | USD value of the source amount, used for analytics and diagnostics. |
| `disabled` | No | Host-controlled flag that records the quote stage as disabled in SDK analytics. Supply the host's disabled state consistently when it intentionally suppresses Liquidity Hub participation. |

Important quote response fields:

| Field | Purpose |
| --- | --- |
| `inToken` | ERC-20 source token used by the executable quote. |
| `outToken` | Destination token used by the quote. |
| `inAmount` | Source amount in base units. |
| `outAmount` | Quoted output before the final executable-minimum comparison. Use it for display only when appropriate. |
| `minAmountOut` | Liquidity Hub executable minimum output. Use this field for route selection. |
| `user` | Wallet address that requested, owns, and signs this quote. |
| `slippage` | Percentage tolerance applied when the quote was created. |
| `qs` | Opaque quote metadata. Preserve it unchanged. |
| `partner` | Orbs-provided partner identifier used for attribution. |
| `exchange` | Liquidity Hub execution source selected for this quote. Preserve it unchanged. |
| `sessionId` | Identifier used for swap submission and status polling. |
| `serializedOrder` | Opaque solver order. Preserve and submit it unchanged as part of the quote. |
| `permitData` | Raw Permit2 typed data returned with the quote. Preserve it unchanged. |
| `eip712` | SDK-provided EIP-712 representation. Preserve it with the quote, but use the normalized `permitData` path in this guide for wallet compatibility. |
| `userMinOutAmountWithGas` | User-protected minimum output after gas effects are included. |
| `outAmountWsMinusGas` | Slippage-adjusted output after subtracting the estimated gas value. |
| `outAmountWS` | Quoted output after applying slippage protection. |
| `gasAmountOut` | Estimated gas cost expressed in destination-token base units. |
| `referencePrice` | Reference market price recorded for diagnostics. |
| `amountOutUI` | Comparison amount echoed by the quote service for UI diagnostics. Do not use it for route selection. |
| `inTokenUsd` | Source-token USD reference price used by the quote service. |
| `outTokenUsd` | Destination-token USD reference price used by the quote service. |
| `timestamp` | Local quote time in milliseconds, used by `isFreshQuote`. |
| `error` | Optional service error string returned with a non-executable quote. Apply the retry rules in Errors and Recovery. |

Important `permitData` fields:

| Field | Purpose |
| --- | --- |
| `domain.name` | Protocol name included in the EIP-712 signing domain. |
| `domain.chainId` | Chain on which the signature is valid. |
| `domain.verifyingContract` | Permit2 contract that verifies the signature. |
| `types` | Complete ordered EIP-712 type definitions returned by Liquidity Hub. |
| `values.permitted.token` | ERC-20 input token authorized by the signature. |
| `values.permitted.amount` | Maximum authorized input amount in token base units. |
| `values.spender` | Contract allowed to consume the signed Permit2 transfer. |
| `values.nonce` | Permit2 replay-protection nonce. |
| `values.deadline` | Unix timestamp after which the signature expires. |
| `values.witness` | Complete Dutch-order witness bound to the Permit2 authorization. |

The quote also exposes these `eip712` fields for inspection and SDK compatibility:

| Field | Purpose |
| --- | --- |
| `domain` | EIP-712 domain derived from the quote permit data. |
| `types` | Complete EIP-712 type definitions. |
| `primaryType` | Root type signed by the wallet. |
| `message` | Permit2 message equivalent to `permitData.values`. The reference signing path still normalizes raw `permitData` through `_TypedDataEncoder`. |

For the number shown as the Liquidity Hub output in the host UI, the reference integration uses `outAmount + (gasAmountOut || "0")` in destination-token base units. Keep route selection on `minAmountOut`; do not compare or execute on the display amount.

If the current DEX minimum output is already available, pass it as `dexMinAmountOut`. If both routes must start at the same time, pass `"-1"` and compare the 2 protected outputs after both settle:

```ts
const [dexResult, liquidityHubResult] = await Promise.allSettled([
  getDexQuote({ fromToken, toToken, inAmount, slippage }),
  liquidityHub.getQuote({
    fromToken,
    toToken,
    inAmount,
    dexMinAmountOut: "-1",
    slippage,
    account,
    inAmountUsd,
    signal,
  }),
]);

const dexQuote = dexResult.status === "fulfilled" ? dexResult.value : undefined;
const liquidityHubQuote =
  liquidityHubResult.status === "fulfilled"
    ? liquidityHubResult.value
    : undefined;

const selectedRoute =
  liquidityHubQuote &&
  (!dexQuote || BigInt(liquidityHubQuote.minAmountOut) > BigInt(dexQuote.minAmountOut))
    ? { type: "liquidity-hub", quote: liquidityHubQuote }
    : dexQuote
      ? { type: "dex", quote: dexQuote }
      : undefined;
```

If the host executes the DEX route, call `liquidityHub.analytics.dexSwap(...)` after its transaction succeeds. Do not report an attempted or reverted DEX transaction as a successful fallback.

Cancel in-flight requests when the account, chain, token pair, or input amount changes. For interactive applications, debounce amount changes by about 300 milliseconds and refresh an active quote about every 10 seconds.

## Execute the Full Flow

The optional Wagmi v3 reference at the top starts after the host has selected Liquidity Hub. It prepares funds, refreshes the Liquidity Hub quote, signs that fresh quote, submits it, and confirms the returned transaction on-chain. It never submits a DEX transaction.

### Wrap and Approve

Liquidity Hub executes ERC-20 inputs. If the user selected a native source asset such as ETH, BNB, or POL, request the quote with the chain's wrapped token and mark the host input as native. The full-flow example calls the wrapped token's payable `deposit()` function with `quote.inAmount`, waits for a successful receipt, and continues with `quote.inToken`.

The SDK exports common native-token placeholder addresses through `nativeTokenAddresses`, but the host application must supply the correct wrapped token contract for the active chain.

Next, read the ERC-20 allowance where the owner is the connected account and the spender is `permit2Address`. When the allowance is below `quote.inAmount`, approve the exact amount and wait for a successful receipt. A larger or maximum allowance is an explicit product and security decision.

Complete both transactions before requesting a signature. If wrapping or approval fails, do not submit the Liquidity Hub quote.

### Refresh and Sign

Pause the host quote poll before wrapping, approval, refresh, or signing, and resume it in a `finally`/settled handler. Without that guard, a background refresh can replace the selected quote while the wallet prompt is open.

Wrapping and approval can take long enough for the original quote to expire. Immediately before signing, the reference algorithm:

1. Keeps the original quote when `isFreshQuote(originalQuote, 60)` is true.
2. Refetches the Liquidity Hub quote only when the original is stale.
3. Keeps the original quote if the refetch fails to return a quote.
4. Keeps the original quote if the refetched `minAmountOut` is lower than the original.
5. Otherwise signs the fresher, equal-or-better quote.

Do not re-run route selection or fall back to the DEX from inside the signing flow. The host made that decision before execution began.

Liquidity Hub signing differs from Advanced Orders signing. Resolve and normalize `quote.permitData` first:

```ts
import { _TypedDataEncoder } from "@ethersproject/hash";

const permitData = quote.permitData;
const populated = await _TypedDataEncoder.resolveNames(
  permitData.domain,
  permitData.types,
  permitData.values,
  async (name) => name,
);
const payload = _TypedDataEncoder.getPayload(
  populated.domain,
  permitData.types,
  populated.value,
);
const signature = await walletClient.signTypedData({
  account,
  domain: payload.domain,
  types: payload.types,
  primaryType: payload.primaryType,
  message: payload.message,
});
```

The signature must belong to the same account passed to `getQuote`. Submit the exact fresh quote object that produced `permitData`; changing the token, amount, user, slippage, or another quote field after signing invalidates the signature.

The host application owns route selection before this flow begins. Read its current quote and form values from the existing derived swap-data hook; no DEX executor callback is required.

### Execute and Confirm

After signing, check freshness again and pass the same `quote` and `signature` to `liquidityHub.swap`. The SDK submits the signed quote and polls until it receives an on-chain transaction hash. Treat a rejected signature, validation response, backend error, or polling timeout as a failed Liquidity Hub execution.

After receiving the hash, wait for its receipt with the Viem `PublicClient` configured for the active chain and require `receipt.status === "success"`. Then call `liquidityHub.getTransactionDetails(txHash, quote)` to retrieve service status, `exactOutAmount`, gas charges, and `isMined`. The SDK method adds protocol execution details; it does not replace receipt confirmation.

Do not report success only because the wallet produced a signature or `swap` accepted the request. Report success after the receipt succeeds, call `liquidityHub.analytics.swap.onSuccess()`, and retain the transaction details for the final amount shown to the user. On failure, call `liquidityHub.analytics.swap.onFailed(errorMessage)` before returning the error.

```ts
try {
  const txHash = await liquidityHub.swap(quote, signature);
  const receipt = await publicClient.waitForTransactionReceipt({
    hash: txHash,
  });
  if (receipt.status !== "success") {
    throw new Error("Liquidity Hub swap reverted");
  }

  const details = await liquidityHub.getTransactionDetails(txHash, quote);
  liquidityHub.analytics.swap.onSuccess();
  return { txHash, receipt, details };
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  liquidityHub.analytics.swap.onFailed(message);
  throw error;
} finally {
  setQuotePollingPaused(false);
}
```

## Analytics and DEX Fallback

The SDK records quote stages automatically. Report the wallet-controlled stages around the corresponding operations so Liquidity Hub can distinguish user rejection, transaction failure, and a route that lost to the DEX:

```ts
liquidityHub.analytics.wrap.onRequest();
liquidityHub.analytics.wrap.onSuccess(wrapTxHash);
liquidityHub.analytics.wrap.onFailed(errorMessage);

liquidityHub.analytics.approval.onRequest();
liquidityHub.analytics.approval.onSuccess(approvalTxHash);
liquidityHub.analytics.approval.onFailed(errorMessage);

liquidityHub.analytics.signature.onRequest();
liquidityHub.analytics.signature.onSuccess(signature);
liquidityHub.analytics.signature.onFailed(errorMessage);

liquidityHub.analytics.swap.onSuccess();
liquidityHub.analytics.swap.onFailed(errorMessage);
```

Always report a successful DEX fallback after its receipt succeeds:

```ts
liquidityHub.analytics.dexSwap({
  panel: "swap",
  router: dexRouterName,
  srcTokenAddress: fromToken,
  dstTokenAddress: toToken,
  inAmount,
  inAmountUsd,
  txHash: dexTxHash,
});
```

Do not fire both `swap.onSuccess()` and `dexSwap` for one user action. Report the route that actually mined. Keep the same SDK instance from quote selection through analytics so its session and Liquidity Hub identifiers remain intact.

For local diagnostics, setting `localStorage.lhDebug` to a non-empty value enables SDK console logging. `localStorage.lhOverrideApiUrl` overrides the quote/status API origin. Treat both as local development escape hatches: never set them for users or persist an override in production.

## Errors and Recovery

If Liquidity Hub cannot produce a usable quote, return the error to the host quote cycle. A DEX route may still win there, but the Liquidity Hub signing flow itself never submits another route.

If a Liquidity Hub swap fails after the user has already wrapped or approved, explain that those preparatory transactions may still have succeeded. Let the user retry with a fresh Liquidity Hub quote. When a native source asset has already been wrapped, keep the form state consistent with the wrapped balance or explicitly unwrap it before a later attempt.

Common quote failures include:

Only errors containing `"not supported"` or `"ldv"` stop polling and automatic retries. Other quote failures may retry up to 2 times and participate again in the next quote cycle.

| Error | Meaning and action |
| --- | --- |
| Contains `"not supported"` | Pair or token is unsupported. Stop polling and retries until the selected tokens change. Do not branch solely on the short `"tns"` code. |
| Contains `"ldv"` | Input value is below the supported threshold. Stop polling and retries until the amount changes. |
| `"no liquidity"` | No solver filled this request. Retry within the normal limit, then allow a later quote cycle to try again. |
| `"timeout"` | Quote request exceeded its timeout. Retry within the normal limit, then allow a later quote cycle to try again. |
| Other error or `quote.error` | Preserve the message for diagnostics, retry within the normal limit, and never treat the quote as executable while `error` is present. |

## Operational Checklist

| Check | Action | Expected result | If it fails |
| --- | --- | --- | --- |
| Client | Reuse one SDK client for the active chain and use the Orbs-provided partner name or `"unknown"`. | Quote requests use the same chain and partner. | Recreate the client after the chain changes. |
| Quote cycle | Request Liquidity Hub during the existing host quote cycle, pass `"-1"` when no DEX minimum exists, debounce inputs, and cancel obsolete requests. | The selected Liquidity Hub quote describes the current wallet, pair, amount, and chain. | Do not enter the Liquidity Hub execution flow. |
| Preparation | Wrap native input and approve `permit2Address`, checking both receipts. | Prepared ERC-20 balance and allowance cover `quote.inAmount`. | Explain which transaction reverted and stop submission. |
| Freshness | Pause polling, keep a fresh original quote, and replace a stale quote only with an equal-or-better refresh. | Signing and submission use the same selected quote object. | Keep the original quote when refresh is missing or worse; surface a later swap rejection normally. |
| Submission | Submit the exact signed quote, confirm the returned hash on-chain, and fetch SDK transaction details. | Receipt status is `success`; the details contain the final execution amount/status. | Show the failure and call `analytics.swap.onFailed`. |
| Analytics | Report wrap, approval, signature, Liquidity Hub success/failure, and every mined DEX fallback. | Exactly 1 executed route is reported for the user action. | Fix missing or duplicated lifecycle callbacks before launch. |
| Recovery | Exercise timeout, no-liquidity, stale, and lower-price cases. | Every case stops without submitting an invalid Liquidity Hub transaction. | Keep the flow blocked until a new valid quote is available. |

Ready to launch when every row passes on each supported chain.
