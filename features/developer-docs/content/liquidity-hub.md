# Liquidity Hub Integration

This guide is for teams that want to add Orbs Liquidity Hub to an existing DEX, swap application, or trading service without adopting a specific UI framework.

Liquidity Hub is an optimization layer. Request its quote during the existing DEX quote cycle, then enter this execution guide after the host application selects Liquidity Hub.

## Concepts

| Term | Meaning |
| --- | --- |
| Liquidity Hub | Orbs optimization layer that requests liquidity from on-chain and off-chain solvers. It is used only when it improves the user's executable result. |
| Permit2 | Token permission contract that receives ERC-20 allowance for Liquidity Hub swaps. The current address is `0x000000000022D473030F116dDEE9F6B43aC78BA3`. |
| Quote signing data | `quote.permitData` contains the raw Permit2 data, and `quote.eip712` contains its wallet-ready EIP-712 representation. The user signs the wallet-ready object unchanged. |
| Partner | Partner name supplied by Orbs. If Orbs has not supplied one, use `"unknown"`. |
| Session ID | Quote session identifier returned by Liquidity Hub and carried through swap submission and status polling. |

### Integration Sequence

1. Create one Liquidity Hub SDK client for the active chain.
2. Request a Liquidity Hub quote alongside the existing DEX quote.
3. Wrap a native source asset when required.
4. Approve Permit2 to spend the ERC-20 source token.
5. Refresh the quote, sign its EIP-712 permit data, and submit the swap.
6. Confirm the Liquidity Hub transaction, or stop before submission when its quote fails, expires, or refreshes with a lower `minAmountOut`.

## Integration Resources

- [UI](https://orbs-spot.vercel.app)
- [Code · orbs-spot](https://github.com/orbs-network/orbs-spot/blob/main/components/best-trade-form.tsx)
- [Code · spot-ui](https://github.com/orbs-network/spot-ui/blob/master/apps/web/components/best-trade-form.tsx)
- [Integration Skill](https://github.com/orbs-network/spot-ui/tree/master/skills/liquidity-hub-integration)

## Install and Initialize

Install the plain JavaScript SDK and Viem. Neither requires React:

```bash
npm install @orbs-network/liquidity-hub-sdk viem
```

Create one Liquidity Hub client for the active chain and reuse it for quote and swap operations. Create a new client when the active chain changes; do not create a new client for every quote.

```js
import { constructSDK } from "@orbs-network/liquidity-hub-sdk";

const partner = "unknown"; // Replace with the partner name supplied by Orbs.

function createLiquidityHubClient(chainId) {
  return constructSDK({
    chainId,
    partner,
  });
}

let liquidityHub = createLiquidityHubClient(137);

function changeChain(nextChainId) {
  liquidityHub = createLiquidityHubClient(nextChainId);
}
```

Use the `partner` name supplied by Orbs. If Orbs has not supplied one, use the lowercase string `"unknown"`.

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
| `dexMinAmountOut` | No, recommended | Current DEX route's executable minimum output, in destination-token base units. Omit only when both quote requests must start together, then compare after both settle. |
| `account` | Required for execution | User address that will sign and own the swap. |
| `slippage` | Yes | Percentage tolerance, such as `0.5` for 0.5%. |
| `signal` | No | `AbortSignal` used to cancel an obsolete quote request. |
| `timeout` | No | Quote timeout override in milliseconds. The SDK default is 10 seconds. |

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
| `eip712` | Wallet-ready EIP-712 representation of `permitData`. Pass it to the wallet unchanged. |
| `userMinOutAmountWithGas` | User-protected minimum output after gas effects are included. |
| `outAmountWsMinusGas` | Slippage-adjusted output after subtracting the estimated gas value. |
| `outAmountWS` | Quoted output after applying slippage protection. |
| `gasAmountOut` | Estimated gas cost expressed in destination-token base units. |
| `referencePrice` | Reference market price recorded for diagnostics. |
| `amountOutUI` | Comparison amount echoed by the quote service for UI diagnostics. Do not use it for route selection. |
| `inTokenUsd` | Source-token USD reference price used by the quote service. |
| `outTokenUsd` | Destination-token USD reference price used by the quote service. |
| `timestamp` | Local quote time in milliseconds, used by `isFreshQuote`. |

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

Important `eip712` fields:

| Field | Purpose |
| --- | --- |
| `domain` | Wallet-ready EIP-712 domain. |
| `types` | Complete wallet-ready type definitions. |
| `primaryType` | Root type signed by the wallet. |
| `message` | Normalized Permit2 message equivalent to `permitData.values`. Sign it unchanged. |

If the current DEX minimum output is already available, pass it as `dexMinAmountOut`. If both routes must start at exactly the same time, do not delay the Liquidity Hub request waiting for that value; omit it for that request and compare the two results after both settle.

Cancel in-flight requests when the account, chain, token pair, or input amount changes. For interactive applications, debounce amount changes by about 300 milliseconds and refresh an active quote about every 10 seconds.

## Execute the Full Flow

The optional Wagmi v3 reference at the top starts after the host has selected Liquidity Hub. It prepares funds, refreshes the Liquidity Hub quote, signs that fresh quote, submits it, and confirms the returned transaction on-chain. It never submits a DEX transaction.

### Wrap and Approve

Liquidity Hub executes ERC-20 inputs. If the user selected a native source asset such as ETH, BNB, or POL, request the quote with the chain's wrapped token and mark the host input as native. The full-flow example calls the wrapped token's payable `deposit()` function with `quote.inAmount`, waits for a successful receipt, and continues with `quote.inToken`.

The SDK exports common native-token placeholder addresses through `nativeTokenAddresses`, but the host application must supply the correct wrapped token contract for the active chain.

Next, read the ERC-20 allowance where the owner is the connected account and the spender is `permit2Address`. When the allowance is below `quote.inAmount`, approve the exact amount and wait for a successful receipt. A larger or maximum allowance is an explicit product and security decision.

Complete both transactions before requesting a signature. If wrapping or approval fails, do not submit the Liquidity Hub quote.

### Refresh and Sign

Wrapping and approval can take long enough for the original quote to expire. Immediately before signing, the full flow:

1. Requests a current Liquidity Hub quote for the prepared swap.
2. Checks `isFreshQuote(quote, 60)`.
3. Compares the refreshed `minAmountOut` with the original quote's `minAmountOut` using `BigInt`.
4. Throws `"Price changed"` if the refreshed minimum is lower.
5. Signs the exact refreshed quote.

`quote.eip712` is the wallet-ready representation of `quote.permitData`. The user signs it unchanged.

The signature must belong to the same account passed to `getQuote`. Submit the exact fresh quote object that produced `permitData`; changing the token, amount, user, slippage, or another quote field after signing invalidates the signature.

The host application owns route selection before this flow begins. Read its current quote and form values from the existing derived swap-data hook; no DEX executor callback is required.

### Execute and Confirm

After signing, check freshness again and pass the same `quote` and `signature` to `liquidityHub.swap`. The SDK submits the signed quote and polls until it receives an on-chain transaction hash. Treat a rejected signature, validation response, backend error, or polling timeout as a failed Liquidity Hub execution.

After receiving the hash, wait for its receipt with the Viem `PublicClient` configured for the active chain and require `receipt.status === "success"`. The optional `liquidityHub.getTransactionDetails(txHash, quote)` helper can add execution details, but it does not replace receipt confirmation.

Do not report success only because the wallet produced a signature or `swap` accepted the request. Report success after `publicClient.waitForTransactionReceipt` returns a successful receipt.

## Errors and Recovery

If Liquidity Hub cannot produce a usable quote, stop this flow and return the error to the host application. This guide does not submit another route.

If a Liquidity Hub swap fails after the user has already wrapped or approved, explain that those preparatory transactions may still have succeeded. Let the user retry with a fresh Liquidity Hub quote. When a native source asset has already been wrapped, keep the form state consistent with the wrapped balance or explicitly unwrap it before a later attempt.

Common quote failures include:

| Error | Meaning and action |
| --- | --- |
| `"no liquidity"` | No solver can fill the requested pair and amount. Stop the Liquidity Hub flow. |
| `"tns"` | Token is not supported. Stop retrying until the selected tokens change. |
| `"ldv"` | Input value is below the supported threshold. Stop the Liquidity Hub flow. |
| `"timeout"` | Quote request did not finish in time. Stop this attempt and allow a later quote cycle to retry. |

## Operational Checklist

| Check | Action | Expected result | If it fails |
| --- | --- | --- | --- |
| Client | Reuse one SDK client for the active chain and use the Orbs-provided partner name or `"unknown"`. | Quote requests use the same chain and partner. | Recreate the client after the chain changes. |
| Quote cycle | Request Liquidity Hub during the existing host quote cycle, debounce inputs, and cancel obsolete requests. | The selected Liquidity Hub quote describes the current wallet, pair, amount, and chain. | Do not enter the Liquidity Hub execution flow. |
| Preparation | Wrap native input and approve `permit2Address`, checking both receipts. | Prepared ERC-20 balance and allowance cover `quote.inAmount`. | Explain which transaction reverted and stop submission. |
| Freshness | Refresh before signing; check `isFreshQuote` before and after the signature. | The refreshed `minAmountOut` is not lower than the original quote. | Show `"Price changed"` and do not submit. |
| Submission | Submit the exact signed quote and confirm the returned hash on-chain. | Receipt status is `success`. | Show the failure and do not report the swap as complete. |
| Recovery | Exercise timeout, no-liquidity, stale, and lower-price cases. | Every case stops without submitting an invalid Liquidity Hub transaction. | Keep the flow blocked until a new valid quote is available. |

Ready to launch when every row passes on each supported chain.
