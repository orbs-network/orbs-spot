import assert from "node:assert/strict";
import test from "node:test";
import { Partners, QuoteError } from "@orbs-network/spot-ui";
import { spotSwapQuoteQueryOptions } from "../lib/swap/quotes.ts";

const input = { address: "0x1111111111111111111111111111111111111111", decimals: 18 };
const output = { address: "0x2222222222222222222222222222222222222222", decimals: 6 };
const account = "0x3333333333333333333333333333333333333333";
const native = { ...input, address: "0x0000000000000000000000000000000000000000" };
const amounts = { amountOut: "10000003", netAmountOut: "9999999", minimumAmountOut: "9800000", feeAmount: "4" };
function configuredClient(partner = Partners.External, chainId = 56) {
  return { partner, chainId, async getQuote({ signal, ...params }) {
    signal?.throwIfAborted();
    return { ...amounts, receivedAt: Date.now(), request: { ...params, partner: this.partner, chainId: this.chainId } };
  } };
}
const options = (overrides = {}) => spotSwapQuoteQueryOptions(
  "client" in overrides ? overrides.client : configuredClient(overrides.partner, overrides.chainId),
  overrides.account ?? account, overrides.input ?? input,
  overrides.output ?? output, overrides.amount ?? "1000000000000000000", overrides.slippage ?? 0.5, input.address);

async function request(query, signal = new AbortController().signal) {
  return query.queryFn({ signal, queryKey: query.queryKey });
}

test("the configured client quotes the full raw input and displays the exact net output and minimum", async t => {
  const client = configuredClient();
  let payload;
  const getQuote = client.getQuote;
  t.mock.method(client, "getQuote", async function (params) {
    assert.equal(this, client);
    payload = params;
    return getQuote.call(this, params);
  });
  const signal = new AbortController().signal;
  const quote = await request(options({ client }), signal);
  assert.deepEqual(payload, { inToken: input.address, outToken: output.address,
    inAmount: "1000000000000000000", user: account, slippage: 0.5, dexMinAmountOut: "-1", signal });
  assert.equal(quote.originalQuote.request.partner, client.partner);
  assert.equal(quote.originalQuote.request.chainId, client.chainId);
  assert.equal(quote.outAmount, "9999999");
  assert.equal(quote.minAmountOut, "9949999");
  assert.equal(quote.originalQuote.amountOut, "10000003");
  assert.equal(quote.slippage, 0.5);
  assert.equal("gas" in quote, false);
});

test("native input quotes the wrapped ERC-20 while preserving the host input identity", async t => {
  const client = configuredClient();
  let payload;
  const getQuote = client.getQuote;
  t.mock.method(client, "getQuote", async function (params) { payload = params; return getQuote.call(this, params); });
  const quote = await request(options({ client, input: native }));
  assert.equal(payload.inToken, input.address);
  assert.equal(quote.inToken, native.address);
  assert.equal(quote.originalQuote.request.inToken, input.address);
});

test("quote keys isolate amount, tokens, signer, partner, network, wrapping, and slippage", () => {
  const base = options();
  for (const override of [
    { account: "0x4444444444444444444444444444444444444444" },
    { partner: Partners.Quick }, { chainId: 137 }, { amount: "2" },
    { input: native }, { output: input }, { slippage: 1 },
  ]) assert.notDeepEqual(options(override).queryKey, base.queryKey);
  const normalized = options({ account: account.toUpperCase() });
  assert.deepEqual(normalized.queryKey, base.queryKey);
});

test("quote cancellation is forwarded and empty offers are not retried", async t => {
  const client = configuredClient();
  const controller = new AbortController();
  t.mock.method(client, "getQuote", async params => {
    assert.equal(params.signal, controller.signal);
    throw new QuoteError("No quote", "no-quote", 204);
  });
  const query = options({ client });
  await assert.rejects(request(query, controller.signal), error => error instanceof QuoteError && error.kind === "no-quote");
  assert.equal(query.retry(0, new QuoteError("No quote", "no-quote", 204)), false);
  assert.equal(query.retry(0, new QuoteError("Unavailable", "http", 503)), true);
  assert.equal(query.retry(2, new QuoteError("Unavailable", "http", 503)), false);
});

test("quotes require a configured client and preserve aborted requests", async () => {
  await assert.rejects(request(options({ client: undefined })), /Spot configuration is not ready/);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(request(options(), controller.signal), error => error.name === "AbortError");
});
