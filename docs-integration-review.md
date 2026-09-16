> Historical integration review. This predates the TypeScript SDK migration; see README.md for the current implementation.

# Spot Integration Docs — Review

**Scope:** the developer docs changes on this branch — `features/developer-docs/**`, `app/developers/**`, `components/developer-tools/**`.

**Method:** read all three guides end-to-end in the browser as an integrator would, then verified every API claim against the installed SDKs (`@orbs-network/liquidity-hub-sdk@1.0.97`, `@orbs-network/spot-react@1.1.45`) and compared each documented flow against the canonical implementations in `orbs-network/orbs-spot`, `orbs-network/spot-ui` (including its two integration skills), and `orbs-network/spot-integration-docs`.

`tsc --noEmit` passes on the branch.

---

## Table of contents

1. [Blockers](#1-blockers)
2. [The No-Package guide vs. its upstream source](#2-the-no-package-guide-vs-its-upstream-source)
3. [Liquidity Hub vs. the reference implementation](#3-liquidity-hub-vs-the-reference-implementation)
4. [Advanced Orders (React) vs. the reference implementation](#4-advanced-orders-react-vs-the-reference-implementation)
5. [Contradictions with the resources the docs cite as authoritative](#5-contradictions-with-the-resources-the-docs-cite-as-authoritative)
6. [Rendering, framing, and navigation](#6-rendering-framing-and-navigation)
7. [What is genuinely good](#7-what-is-genuinely-good)
8. [Recommended order of work](#8-recommended-order-of-work)

---

## 1. Blockers

### 1.1 Markdown code blocks are silently dropped on every step that has an interactive example

`features/developer-docs/developer-guide-shell.tsx:563` passes `omitCodeBlocks={hasInteractiveExample}`.

Verified in the browser — on *Request Quotes*, *Execute and Confirm*, and *Cancel Order Sink Orders* there is exactly **one** `<pre>` element on the page, and it belongs to the interactive panel.

Content lost, per step:

| Guide · step | Dropped from the rendered page |
| --- | --- |
| LH · Request Quotes | the `getLiquidityHubQuote` wrapper, and the `Promise.allSettled([getDexQuote, getLiquidityHubQuote])` dual-quote pattern |
| LH · Execute and Confirm | the `swap()` call, and the `waitForTransactionReceipt` block |
| AO · Cancel Order Sink Orders | the `cancelOrder()` function, the `cancel(bytes32[])` JSON ABI, and the address/function/digests block |

The `Promise.allSettled` block is the central idea of the Liquidity Hub guide and it is invisible on the page. On the Cancel step the prose immediately below then discusses `orderSinkOrder` — a variable that appears nowhere in any visible code.

Steps *without* an interactive example render their code blocks correctly, with Copy and Full screen. The omission is confined to the seven interactive steps.

### 1.2 The No-Package guide has no protocol specification

It promises "Java, Python, TypeScript, Go, or any other stack," but the only normative artifact for order creation is a React + wagmi + viem hook. There is no `/config` response shape, no `POST /orders/new` schema, no field definitions, no units.

That content exists in the codebase — `PERMIT_DATA_REQUEST_DATA`, `PERMIT_DATA_RESPONSE`, `PERMIT_DATA_CODE_SNIPPET` in `components/developer-tools/code-examples.ts` — but is rendered nowhere. Dead exports. The rename in this diff (`PERMIT_CONFIG_*` → `PERMIT_DATA_*`) only touched dead code.

### 1.3 A TWAP order cannot be built from the guide

The witness fields are hardcoded magic numbers with no explanation anywhere on the page: `nonce: "42"`, `epoch: 3600`, `freshness: 300`, `exclusivity: 0`, `slippage: 100`, `share: 0`, `input.amount` vs `input.maxAmount` vs `permitted.amount`, `output.limit` / `triggerLower` / `triggerUpper`.

No units are stated. Is `slippage: 100` basis points? Is `deadline` Unix seconds? Liquidity Hub handles this well ("`0.5` means 0.5%, not 50 basis points"); Advanced Orders does it nowhere. The deleted guide at least carried the rule "Use token base units, Unix seconds, and basis points" — that is gone.

See §2 — all of it is specified upstream.

---

## 2. The No-Package guide vs. its upstream source

The guide links `orbs-network/spot-integration-docs` as "Direct integration reference." That README is **695 lines**:

```
Concepts · Integration Resources · Function Contracts · Fetch Partner Config
Prerequisites · Build the Order · Signed Values · Generated Order Fields
Witness Fields · Output Limit And Trigger Rules · Sign the EIP-712 Data
Submit to Order Sink · Fetch Order Sink Orders · Cancel Order Sink Orders
Operational Checklist
```

`features/developer-docs/content/advanced-orders.md` is **178 lines**.

The collapse was deliberate — the `hashAliases` map in `features/developer-docs/guide-content.ts` redirects `fetch-partner-config`, `generated-order-fields`, `sign`, `submit`, `allowance`, `core-setup`, and `end-to-end` all to a single `create-order` section, which then defers to the interactive panel.

### 2.1 Every magic number is defined upstream

| Docs page shows | `spot-integration-docs` defines |
| --- | --- |
| `nonce: "42"` | "the current Unix time in milliseconds" |
| `slippage: 100` | "basis points. For example, `50` means `0.5%` and `100` means `1%`" |
| `epoch: 3600` | "minimum delay between fills, in seconds. For a one-fill order this is usually `0`" |
| `freshness: 300` | "quote/oracle freshness window in seconds. **Defaults to `60`** unless Orbs explicitly gives the integration a different value" |
| `input.amount` | "source amount per fill/chunk" |
| `input.maxAmount` | "maximum total source amount the order may consume. **This should match `permitted.amount`**" |
| `deadline` / `start` | "Unix timestamp in seconds, serialized as a decimal string" |
| `triggerLower` / `triggerUpper` | stop-loss → `triggerLower`; take-profit → `triggerUpper`; `"0"` for everything else |
| `output.limit` | "minimum destination amount required per fill. Use `"0"` for market-style execution" |

The sample value `freshness: 300` contradicts the documented default of `60`.

Upstream also carries serialization guidance the page lacks: *"use plain integer decimal strings. Avoid scientific notation, decimal points, or locale formatting"* and *"there are no additional order-type or helper trigger fields in the EIP-712 message or in the Order Sink request body."*

### 2.2 The order-building approach is inverted

Upstream's `buildRePermitOrderData` starts from the fetched template and overrides only integration-owned fields:

```js
const order = {
  ...permitData.order,
  permitted: { ...permitData.order.permitted, token: srcToken, amount: srcAmount },
  nonce,
  deadline,
  witness: {
    ...permitData.order.witness,
    swapper: account,
    nonce, start, deadline, epoch,
    slippage: slippageBps,
    freshness,
    input:  { ...permitData.order.witness.input,  token: srcToken, amount: srcAmountPerTrade, maxAmount: srcAmount },
    output: { ...permitData.order.witness.output, token: dstToken, limit, triggerLower, triggerUpper, recipient: account },
  },
};
```

Reactor, executor, exchange metadata, spender, and exclusivity all survive from the server response.

The docs' interactive snippet builds the message literal from scratch with `spender: "0x2222…"`, `reactor: "0x3333…"`, `adapter: "0x8888…"` — hardcoding exactly what the same page's prose forbids:

> "The RePermit contract, reactor, executor, exchange adapter, and fee reference addresses come from the fetched partner configuration. Do not hardcode them in the integration."

`orbs-spot/lib/hooks/use-base-permit-data.ts` confirms `/config` returns the template — it reads `order.witness.exchange.adapter` straight off the response.

### 2.3 The reference validates `/config`; the docs example does not

```js
if (!isAddress(basePermitData.domain?.verifyingContract) ||
    !isAddress(basePermitData.order?.witness?.exchange?.adapter) ||
    isAddressEqual(basePermitData.domain.verifyingContract, zeroAddress) ||
    isAddressEqual(basePermitData.order.witness.exchange.adapter, zeroAddress)) {
  throw new Error("Base permit data is missing contract addresses");
}

if (basePermitData.domain.chainId !== chainId ||
    basePermitData.order.witness.chainid !== chainId) {
  throw new Error("Base permit data does not match the selected chain");
}
```

The chain check is item 2 on the docs' own Operational Checklist, and it is unimplemented in the docs' example. The reference also caches with `staleTime: Infinity` (fetch once per partner/chain) and uses `encodeURIComponent(partner)`; the docs interpolate raw.

### 2.4 Bugs in the copyable create-order snippet

| Issue | Detail |
| --- | --- |
| **Native wrap under-wraps** | `deposit()` is sent `order.witness.input.amount` (per-chunk) rather than `permitted.amount` / `maxAmount` (total). A 10-chunk native order wraps 1/10 of what the order can pull. Confirmed against the upstream field spec. |
| **Dead native branch** | `if ("0x1111…".toLowerCase() === zeroAddress)` is always false. The native path can never execute. |
| **Allowance check disagrees with the checklist** | Checklist says "at least `order.permitted.amount`"; the code checks `order.witness.input.amount`. |
| **Chain mismatch in the sample** | Fetches `chain=1` with `witness.chainid: 1`, while every other sample on the site uses 137 — violating the guide's own checklist item. |
| **Naming drift** | Prose defines `fetchRePermitData(partner, chainId)`; the snippet calls `getPermitConfig()` and still throws `"Failed to fetch permit config"`. The rename only landed in `formatPermitDataFetchCode`, which is dead code. |

---

## 3. Liquidity Hub vs. the reference implementation

Compared against `orbs-spot/lib/hooks/{liquidity-hub,use-trade,use-swap-best-trade,use-sign-eip,use-approval,use-wrap,use-token-approval}.ts` and `spot-ui/skills/liquidity-hub-integration/`.

### 3.1 Analytics is an entire missing subsystem

The SDK exposes `sdk.analytics` with `swap`, `dexSwap`, `wrap`, `approval`, and `signature` callbacks. The linked skill mandates them — guardrail #6, a checklist item, and in bold:

> **Always report `dexSwap` when falling back to the DEX router.** This lets the protocol learn from missed opportunities and improve future quotes.

The docs page mentions analytics **zero times**. This is the mechanism by which Liquidity Hub improves for a specific partner, and it is absent from the partner-facing documentation.

### 3.2 `dexMinAmountOut` when there is no DEX quote

Docs say omit it. The reference passes a sentinel:

```js
// No DEX router quote exists in this reference app. Production DEXes
// should pass their router's slippage-adjusted minimum output here.
dexMinAmountOut: "-1",
```

Omitting and sending `-1` are not equivalent to the backend.

### 3.3 Signing does not work the way the page shows it

The page says pass `permitData` fields to the wallet unmodified. `orbs-spot/lib/hooks/use-sign-eip.ts` normalizes through ethers first:

```js
const populated = await _TypedDataEncoder.resolveNames(
  permitData.domain, permitData.types, permitData.values, async (name) => name,
);
const payload = _TypedDataEncoder.getPayload(
  populated.domain, permitData.types, populated.value,
);
const signature = await signTypedData(payload);
```

This is why `@ethersproject/hash` is a dependency of this repo, and `lib/hooks/use-sign-eip.ts` here is identical. Advanced Orders' `signOrder` in the same reference app does *not* need this step — that asymmetry deserves an explicit sentence, because a developer implementing both will assume one path works for the other.

### 3.4 Quote polling must be paused during execution

`useSwapBestTrade` calls `setPauseQuote(true)` before the flow and clears it in `onSettled`; `useQuoteLiquidityHub` gates `refetchInterval` on it. Without this, a background refetch mutates the quote mid-signature. Not documented.

### 3.5 Refresh-before-signing is a different algorithm

The reference never falls back to the DEX at signing time. It keeps the original quote if fresh, and if the refetch is *worse*, keeps the original anyway:

```js
if (isFreshQuote(originalQuote, 60)) return originalQuote;
const freshQuote = (await refetchTrade())?.data?.originalQuote;
if (!freshQuote) return originalQuote;
if (BN(freshQuote.minAmountOut).lt(BN(originalQuote.minAmountOut))) return originalQuote;
return freshQuote;
```

The docs describe an unconditional dual refetch with a DEX fallback.

### 3.6 The error table does not match how anything branches

```js
const stopQuoteLiquidityHub = (_error) => {
  const error = _error.toLowerCase();
  if (error.includes("not supported")) return true;
  if (error.includes("ldv")) return true;
  return false;
};
```

Only `"not supported"` and `"ldv"` stop polling and retries; everything else retries twice. The docs list `"tns"` as the not-supported code, and give `"no liquidity"` and `"timeout"` equal billing without noting they are retryable.

### 3.7 The display amount is undocumented

```js
outAmount: BN(quote.outAmount).plus(BN(quote.gasAmountOut || "0")).toFixed(0),
```

The docs describe `gasAmountOut` as "optional gas cost expressed in output-token terms" and leave the convention to guesswork. Integrators will show the wrong number.

### 3.8 Also absent

- `getTransactionDetails(txHash, quote)` — the skill's step 7, and the only way to learn `exactOutAmount` / `isMined`. Docs use viem's receipt and never mention the SDK method.
- `blockAnalytics`, `inAmountUsd`, `disabled` quote arguments.
- `lhDebug` and `lhOverrideApiUrl` localStorage escape hatches (both confirmed present in the SDK bundle).
- `Quote.user` and `Quote.error` — the docs' own `prepareLiquidityHubSwap` example reads `latestQuote.user`, but the field table omits both.

### 3.9 The linked "Code" resource does not demonstrate the flow

`best-trade-form.tsx` renders `trade?.minAmountOut`. The reference app is Liquidity-Hub-only with no DEX comparison anywhere. The guide's entire premise — request both routes, compare, execute the winner — has no working example in any linked repository.

---

## 4. Advanced Orders (React) vs. the reference implementation

Compared against `orbs-spot/components/advanced-order/{spot-provider-shell,hooks}.tsx` and `spot-ui/skills/spot-react-integration/`. This guide tracks its skill closely and is in the best shape of the three. Three gaps matter.

### 4.1 The install command is wrong

The page says:

```bash
npm install @orbs-network/spot-react@latest
```

> No additional Orbs package is required by this guide.

The skill's guardrail #2 requires `@orbs-network/spot-react`, **`@orbs-network/swap-ui`**, and the peers `@tanstack/react-query`, `bignumber.js`, `react-error-boundary`, `zustand`. `swap-ui` is mandated for the order-creation/progress modal content (guardrail #4, principle #4, two checklist items), and it is already in this repo's `package.json`.

An integrator running that one command gets runtime failures on missing peers.

### 4.2 `marketReferencePrice` staleness gets one sentence

The page says only: *"Quote freshness stays inside the DEX."* The skill provides the actual recipe:

```tsx
const shouldQuote   = Boolean(typedInputAmount && inputCurrency && outputCurrency);
const isQuoteStale  = shouldQuote && typedInputAmount !== quotedInputAmount;
const outputAmount  = !shouldQuote || isQuoteStale ? undefined : quoteOutputRaw;
const isLoading     = shouldQuote && (isQuoteStale || isQuoteLoading);

return { value: outputAmount, isLoading, noLiquidity: shouldQuote && !isLoading && !outputAmount };
```

The key move — compare the typed amount against the amount the quote was *produced for*, and emit `undefined` rather than the stale value — is unguessable from the page. Get it wrong and limit/trigger prices compute off the previous amount.

The reference adds a fallback the page also omits: derive the price from `inputUsd / outputTokenUsd` when no quote exists at all, so the form still functions.

### 4.3 `approveToken` ignores the amount it is handed

```js
approveToken: async (props) => {
  const { hash } = await approveToken({
    tokenAddress: props.tokenAddress,
    spenderAddress: props.spenderAddress,
    amount: maxUint256.toString(),   // props.amount deliberately ignored
  });
  return hash;
}
```

This is correct — a TWAP pulls repeatedly over time, so an exact-amount approval breaks later chunks. The docs' example passes `props.amount` straight through with no comment, which produces a functionally different integration. Worth stating explicitly, since it is a security-relevant deviation an integrator would otherwise "fix" back.

### 4.4 Smaller gaps, each of which bites

| Gap | Detail |
| --- | --- |
| `enableQueryParams={false}` | Set in the reference; never mentioned. The docs actively teach a custom `?order=twap` scheme — if the SDK also writes query params, they fight. |
| `onWrapSuccess` must defer a token swap | The reference queues the wrapped address and applies it after the modal closes: *"Keep the native token visible while the submit flow is open."* Docs say only "refresh balances." |
| User-rejection handling | The reference wraps all five wallet methods in `isUserRejectedError(error)` → toast → rethrow. The docs' adapter example has no error handling at all. |
| Callback coverage | Docs wire 5 callbacks; the reference wires 14 (`onWrapRequest`, `onApproveRequest`, `onSignOrderRequest`, `onSubmitOrderFailed`, `onSubmitOrderRejected`, `onCancelOrderRequest`, `onCancelOrderFailed`, `onCopy`, …). The page's own prose asks for toasts on fills, cancellation, copy, and errors — its example cannot deliver them. |
| `fees` | The reference sets `fees={0}` explicitly. Business-critical; never mentioned. |
| `priceProtection` | A persisted user setting in the reference and a skill checklist item; the docs hardcode `3` with no explanation of range or meaning. |
| `minChunkSizeUsd` | Hardcoded `5`; the SDK exports `getMinChunkSizeUsd()`, unmentioned. |
| Missing guardrails | Never import from `dist/*`; do not add your own ErrorBoundary (spot-react ships one); the escape-hatch hooks `useRePermitData` / `useSignOrder` / `useSubmitOrder` / `useSwapExecution`; "Powered by Orbs" attribution where the integration agreement requires it. |

The panel-visibility table matches the skill exactly.

---

## 5. Contradictions with the resources the docs cite as authoritative

A careful integrator who reads both the page and the resources it links has to guess on all of these.

| Question | Docs page | Skill | Reference app |
| --- | --- | --- | --- |
| Partner identifier | `"external"`; *"do not invent one from the application name"* | *"Set the `partner` field to the DEX name (lowercase, e.g. `"myDex"`)"* | partner registry |
| Permit2 approval amount | prose: exact, max "should be explicit" — snippet: `maxUint256` | `maxUint256` | exact |
| LH signing path | raw `permitData` fields | raw `permitData` fields | ethers `_TypedDataEncoder` normalization |
| `dexMinAmountOut` with no DEX quote | omit | pass the DEX minimum | `"-1"` |
| Field to compare routes on | `minAmountOut` | `minAmountOut` in best-practices; `userMinOutAmountWithGas` in the type annotation | `minAmountOut` |

The last row is worth resolving upstream too — the skill contradicts itself on the single most consequential decision in the integration.

### Broken and private links

`orbs-network/orbs-spot` is a **private repository**. The docs link it twice under "Integration Resources":

- `https://github.com/orbs-network/orbs-spot/blob/main/components/best-trade-form.tsx` (Liquidity Hub → "Code")
- `https://github.com/orbs-network/orbs-spot/blob/main/components/advanced-order/spot-provider-shell.tsx` (Advanced Orders React → "provider-shell example")

External integrators get a 404. `spot-ui`, its two skills, and `spot-integration-docs` are all public and resolve correctly.

---

## 6. Rendering, framing, and navigation

- **"Interactive React reference"** heads every panel — including on the Liquidity Hub guide, whose opening line is "without adopting a specific UI framework" and "Neither requires React," and on the guide named *No Package*. The markdown teaches plain Viem `publicClient` / `walletClient`; the panel teaches a wagmi hook. Two stacks per step, with no statement of which is canonical.
- **wagmi version is unstated.** Snippets use `useConnection`, which exists only in wagmi v3 (v2 is `useAccount`). Correct for this repo (3.6.16), but a DEX on v2 hits an import error with no hint why.
- **"The interactive reference below"** — it renders *above* the prose everywhere, because of `codeBlocksFirst` plus the example being rendered first. Every "below" is wrong.
- **LH Overview leads with the flow diagram**, before the intro paragraph, so the first thing on screen is `getLatestQuote()`, `quote.inToken`, and `isFreshQuote()` with no preceding definition. The diagram's 6 steps also do not match the "seven core operations" list directly beneath it, and `getLatestQuote()` reads like an SDK function — grepping the SDK finds nothing, because it is a callback the docs' own example takes as a parameter.
- **The provider step's instructions do not work.** *"Hover or focus any underlined prop to read its contract"* — the DOM has zero underlined elements and zero tooltips in the inline view. Clicking **Full screen** did nothing in my browser: no fullscreen element, no error surfaced. Both worth confirming in a real Chrome before shipping the instruction, since the panel is height-bounded and the docs tell readers to rely on it.
- **Wizard-only navigation** — 11 / 7 / 11 steps, one section per screen, no single-page view and no search. `Ctrl+F` for `repermitDigest` across a guide is impossible. Deep links do work (`#request-quotes`) and the `hashAliases` map is a good touch for preserving old links.
- **Mobile** works but stacks roughly 950px of chrome above the first line of step content.

---

## 7. What is genuinely good

- **Fetch Order History is the model the other steps should follow** — request/response tabs, a real cURL, per-field tooltips, and `metadata.repermitDigest` present in the sample response.
- **The provider example is accurate.** `features/developer-docs/advanced-orders-provider-example.ts` matches `SpotProps` exactly — both required props present, adapters memoized, callbacks correctly shaped.
- **Every `spot-react` symbol in the React guide exists in 1.1.45 and the shapes match** — `orderHistoryPanel.orders.{all,open,completed,cancelled,expired}`, the `OrderFilter.toLowerCase()` key trick, `useCancelOrder` → `{disabled, isLoading, cancelOrder}`, the full `derivedFormData` surface, `useDerivedHistoryOrder(order, srcToken, dstToken)`.
- `isFreshQuote(quote, 60)` is correct — seconds, default 60. `permitData.values` matches `lib/hooks/use-sign-eip.ts`.
- **The LH supported-chains table checks out exactly** against the SDK's endpoint switch (137, 56, 250, 8453, 59144, 81457, 1101, 146, 42161, plus Ethereum on the default host). Flare, added in the most recent commit, is not listed — confirm whether that is intentional.
- The panel-visibility matrix in the React guide matches the skill precisely.

---

## 8. Recommended order of work

1. **Fix `omitCodeBlocks`.** One prop, and it is currently deleting the best prose-side code in the docs.
2. **Stop summarizing `spot-integration-docs` — render it.** The No-Package guide's job is to present those 695 lines well, not compress them to 178 and defer to a React snippet. At minimum restore *Fetch Partner Config*, *Build the Order*, *Witness Fields*, and *Output Limit And Trigger Rules* as real sections.
3. **Replace the create-order snippet with the upstream builder** (spread-the-template), and add the config validation from `use-base-permit-data.ts`. Fix the native-wrap amount and the dead native branch while you are in there.
4. **Add an Analytics section to the Liquidity Hub guide.** It is the one thing that makes LH improve for the partner, and it is entirely absent.
5. **Fix the React install command** — add `@orbs-network/swap-ui` and the four peer dependencies, and drop "No additional Orbs package is required."
6. **Promote the `marketReferencePrice` freshness recipe** from one sentence to the code block the skill already contains.
7. **Reconcile the five contradictions in §5** with the resources the page cites as authoritative.
8. **Either make `orbs-spot` public or stop linking it.**
9. Relabel "Interactive React reference," fix every "below" that means "above", state the wagmi version, and verify the tooltip and Full-screen affordances actually work.
