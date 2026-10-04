/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, mocks = {}) {
  const source = fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8');
  const exports = {};
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText, { exports, structuredClone, TextDecoder, require: id => Object.hasOwn(mocks, id) ? mocks[id] : require(id) });
  return exports;
}
const { createSwapExecutor, assertSwapQuote } = load('lib/swap/execution.ts');
const account = '0x1111111111111111111111111111111111111111';
const inputToken = '0x2222222222222222222222222222222222222222';
const outputToken = '0x3333333333333333333333333333333333333333';
const hash = '0x' + 'ab'.repeat(32);
function fixture() {
  const calls = [];
  const intent = { account, chainId: 56, inputToken, outputToken, amount: '100', native: true };
  const quote = { user: account, inToken: inputToken, outToken: outputToken, inAmount: '100', outAmount: '200', minAmountOut: '195', eip712: { domain: { chainId: 56 } }, timestamp: Date.now() };
  const port = {
    intent, quote,
    assertWallet: async () => calls.push('wallet'),
    hasAllowance: async () => false,
    wrap: async amount => calls.push(`wrap:${amount}`),
    approve: async () => calls.push('approve'),
    refreshQuote: async () => ({ ...quote, timestamp: Date.now() }),
    sign: async () => { calls.push('sign'); return '0xsignature'; },
    submit: async () => { calls.push('submit'); return hash; },
    confirm: async () => { calls.push('confirm'); return { status: 'success' }; },
    onPlan: () => {}, onStep: () => {}, onWrapped: () => {}, onApproved: () => {}, onSubmitted: () => {},
  };
  return { port, calls };
}

test('swap confirms wrapping and approval before signing and submission', async () => {
  const { port, calls } = fixture();
  const result = await createSwapExecutor().execute(port);
  assert.equal(result.txHash, hash);
  assert.deepEqual(calls.filter(c => c !== 'wallet'), ['wrap:100', 'approve', 'sign', 'submit', 'confirm']);
});

for (const approved of [false, true]) {
  test(`swap keeps transaction steps pending while allowance loads (approved: ${approved})`, async () => {
    const { port, calls } = fixture();
    port.intent.native = false;
    const steps = [];
    let release;
    const checking = new Promise(resolve => {
      port.hasAllowance = () => new Promise(done => { release = done; resolve(); });
    });
    port.onStep = step => steps.push(step);
    const executor = createSwapExecutor();
    const execution = executor.execute(port);
    await checking;
    assert.equal(executor.isBusy(), true);
    assert.deepEqual(steps, []);
    assert.deepEqual(calls, ['wallet']);
    release(approved);
    await execution;
    assert.deepEqual(steps, approved ? ['SWAP'] : ['APPROVE', 'SWAP']);
    assert.equal(executor.isBusy(), false);
  });
}

test('failed allowance checks release submission without starting a transaction', async () => {
  const { port, calls } = fixture();
  const steps = [];
  port.hasAllowance = async () => { throw new Error('Allowance unavailable'); };
  port.onStep = step => steps.push(step);
  const executor = createSwapExecutor();
  await assert.rejects(executor.execute(port), /Allowance unavailable/);
  assert.deepEqual(steps, []);
  assert.deepEqual(calls, ['wallet']);
  assert.equal(executor.isBusy(), false);
});

test('an expired quote with a worse replacement stops before any wallet write', async () => {
  const { port, calls } = fixture();
  port.quote.timestamp -= 61_000;
  port.refreshQuote = async () => ({ ...port.quote, timestamp: Date.now(), minAmountOut: '190' });
  await assert.rejects(createSwapExecutor().execute(port), /Quote changed/);
  assert.deepEqual(calls, ['wallet']);
});

test('a refreshed quote must preserve account, chain, tokens and amount', () => {
  const { port } = fixture();
  for (const patch of [{ user: inputToken }, { inToken: outputToken }, { outToken: inputToken }, { inAmount: '101' }, { eip712: { domain: { chainId: 1 } } }, { minAmountOut: '0' }]) {
    assert.throws(() => assertSwapQuote({ ...port.quote, ...patch }, port.intent), /does not match/);
  }
});

test('wallet changes after signing prevent submission', async () => {
  const { port, calls } = fixture();
  let signed = false;
  port.sign = async () => { signed = true; return '0xsignature'; };
  port.assertWallet = async () => { if (signed) throw new Error('Wallet changed'); };
  await assert.rejects(createSwapExecutor().execute(port), /Wallet changed/);
  assert.equal(calls.includes('submit'), false);
});

test('a confirmed native wrap is not repeated after a rejected signature', async () => {
  const { port, calls } = fixture();
  const executor = createSwapExecutor();
  const sign = port.sign;
  port.sign = async () => { throw new Error('User rejected'); };
  await assert.rejects(executor.execute(port), /User rejected/);
  port.sign = sign;
  await executor.execute(port);
  assert.equal(calls.filter(c => c.startsWith('wrap')).length, 1);
});

test('concurrent swap attempts share a lock and do not duplicate writes', async () => {
  const { port, calls } = fixture();
  const executor = createSwapExecutor();
  let release;
  port.hasAllowance = () => new Promise(resolve => { release = resolve; });
  const first = executor.execute(port);
  await assert.rejects(executor.execute(port), /already being submitted/);
  while (!release) await Promise.resolve();
  release(true);
  await first;
  assert.equal(calls.filter(c => c === 'submit').length, 1);
  assert.equal(executor.isBusy(), false);
});

test('lost submission responses report ambiguous execution and release the lock', async () => {
  const { port } = fixture();
  const executor = createSwapExecutor();
  port.submit = async () => { throw new Error('Network error'); };
  await assert.rejects(executor.execute(port), /Check wallet activity before retrying/);
  assert.equal(executor.isBusy(), false);
});

const requestTools = load('lib/server/request.ts', { '@/lib/consts': { SUPPORTED_CHAINS: [{ id: 1 }, { id: 56 }] } });
const { validateRpcRequest } = load('lib/server/rpc-request.ts', { './request': requestTools });
test('public endpoints accept only configured integer chain IDs', () => {
  assert.equal(requestTools.parseSupportedChainId('56'), 56);
  for (const chain of [null, true, '', '56junk', 56.5, -1, 999999, {}, []]) {
    assert.throws(() => requestTools.parseSupportedChainId(chain));
  }
});
test('RPC rejects privileged methods, malformed requests and oversized batches', () => {
  const call = { jsonrpc: '2.0', id: 1, method: 'eth_call', params: [] };
  validateRpcRequest(call);
  validateRpcRequest([call, { ...call, id: 2, method: 'eth_getTransactionReceipt' }]);
  for (const body of [null, {}, [], Array(51).fill(call), { ...call, method: 'admin_peers' }, { ...call, method: 'eth_sendRawTransaction' }, { ...call, params: 'bad' }]) {
    assert.throws(() => validateRpcRequest(body));
  }
});
test('request parsing rejects malformed JSON and oversized bodies including streams', async () => {
  assert.equal((await requestTools.readJsonBody(new Request('http://local', { method: 'POST', body: '{"ok":true}' }))).ok, true);
  await assert.rejects(requestTools.readJsonBody(new Request('http://local', { method: 'POST', body: '{' })), /Invalid JSON/);
  await assert.rejects(requestTools.readJsonBody(new Request('http://local', { method: 'POST', body: 'x'.repeat(requestTools.MAX_REQUEST_BYTES + 1) })), error => error.status === 413);
});
test('invalid persisted percentage values resolve to defaults and zero remains valid', () => {
  const { resolvePercent, validPercent } = load('lib/percent-settings.ts');
  for (const value of [NaN, Infinity, -1, 100, null, '3']) assert.equal(resolvePercent(value, 0.5), 0.5);
  assert.equal(resolvePercent(0, 0.5), 0);
  assert.equal(validPercent(99.99), true);
});
test('zero-decimal tokens retain amounts and invalid numeric input cannot throw in render', () => {
  const helpers = load('lib/utils.ts', { './wrapped-currencies': {}, './consts': { hyperEvmChain: { id: 999 }, megaethChain: { id: 998 } } });
  assert.equal(helpers.toAmountWei('42', 0), '42');
  assert.equal(helpers.toAmountUI('42', 0), '42');
  assert.equal(helpers.toAmountWei('garbage', 18), '0');
  assert.equal(helpers.toAmountWei('-1', 18), '0');
});

test('small token prices retain precision for order calculations', () => {
  const price = 0.000000012345;
  const { useUSDPrice } = load('lib/hooks/use-usd-price.ts', {
    react: { useMemo: fn => fn() },
    '@tanstack/react-query': { useQuery: () => ({ data: { token: price } }) },
    '../get-usd-price': { MAX_USD_PRICE_TOKENS: 40 },
    './common': { useFormatNumber: ({ value }) => String(value) },
    '../utils': { getTokenKey: value => value, uniqueTokenAddresses: values => values },
    './use-data-chain-id': { useDataChainId: () => 56 },
  });
  assert.equal(useUSDPrice({ token: 'token' }).data, price);
  assert.equal(useUSDPrice({ token: 'token', amount: '100000000' }).data, 1.2345);
});
