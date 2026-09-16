/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');
const { QueryClient } = require('@tanstack/react-query');

function load(name, globals = {}) {
  const exports = {};
  const source = fs.readFileSync(path.resolve(__dirname, '../lib/hooks', name + '.ts'), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, {
    exports, URLSearchParams, ...globals,
    require: (id) => id === 'wagmi' ? {} : require(id),
  });
  return exports;
}
const { tokenAllowanceQueryOptions } = load('use-token-allowance');
const params = { ownerAddress: '0xAAAA', tokenAddress: '0xBBBB', spenderAddress: '0xCCCC' };
const createCache = () => new QueryClient({ defaultOptions: { queries: { gcTime: 0, retry: false } } });

test('allowance cache separates chains, owners, tokens and spenders', async () => {
  const cache = createCache();
  let calls = 0;
  const client = (id) => ({ chain: { id }, readContract: async () => BigInt(++calls) });
  for (const [chain, input] of [[1, params], [56, params], [1, { ...params, ownerAddress: '0xDDDD' }], [1, { ...params, tokenAddress: '0xEEEE' }], [1, { ...params, spenderAddress: '0xFFFF' }]]) {
    await cache.fetchQuery(tokenAllowanceQueryOptions(client(chain), input));
  }
  assert.equal(cache.getQueryCache().getAll().length, 5);
  const normalized = tokenAllowanceQueryOptions(client(1), { ownerAddress: '0xaaaa', tokenAddress: '0xbbbb', spenderAddress: '0xcccc' });
  assert.equal(cache.getQueryData(normalized.queryKey), '1');
  cache.clear();
});

test('execution rereads allowance after approval rather than accepting cached state', async () => {
  const cache = createCache();
  let allowance = 0n;
  let calls = 0;
  const client = { chain: { id: 56 }, readContract: async () => { calls++; return allowance; } };
  const options = tokenAllowanceQueryOptions(client, params);
  assert.equal(await cache.fetchQuery(options), '0');
  allowance = 100n;
  assert.equal(await cache.fetchQuery(options), '100');
  assert.equal(calls, 2);
  cache.clear();
});

test('concurrent allowance reads share a request and missing accounts never reach RPC', async () => {
  const cache = createCache();
  let finish;
  let calls = 0;
  const client = { chain: { id: 56 }, readContract: () => { calls++; return new Promise((resolve) => { finish = resolve; }); } };
  const options = tokenAllowanceQueryOptions(client, params);
  const first = cache.fetchQuery(options);
  const second = cache.fetchQuery(options);
  finish(42n);
  assert.deepEqual(await Promise.all([first, second]), ['42', '42']);
  assert.equal(calls, 1);
  await assert.rejects(cache.fetchQuery(tokenAllowanceQueryOptions(client, { tokenAddress: '0xBBBB' })), /Missing required allowance/);
  assert.equal(calls, 1);
  cache.clear();
});

test('confirmed receipts are reused for the same chain and hash, with separate chain caches', async () => {
  const requests = [];
  const { transactionReceiptQueryOptions } = load('use-get-transaction-receipt', {
    fetch: async (url, { signal }) => { requests.push(url); assert.ok(signal); return { ok: true, json: async () => ({ status: 'success' }) }; },
  });
  const cache = createCache();
  await cache.fetchQuery(transactionReceiptQueryOptions(1, '0xhash'));
  await cache.fetchQuery(transactionReceiptQueryOptions(1, '0xhash'));
  await cache.fetchQuery(transactionReceiptQueryOptions(56, '0xhash'));
  assert.equal(requests.length, 2);
  assert.match(requests[0], /chainId=1&hash=0xhash/);
  assert.match(requests[1], /chainId=56&hash=0xhash/);
  cache.clear();
});

test('reverted receipts reject without automatic retries', async () => {
  let calls = 0;
  const { transactionReceiptQueryOptions } = load('use-get-transaction-receipt', {
    fetch: async () => { calls++; return { ok: true, json: async () => ({ status: 'reverted' }) }; },
  });
  const cache = createCache();
  await assert.rejects(cache.fetchQuery(transactionReceiptQueryOptions(56, '0xhash')), /Transaction failed/);
  assert.equal(calls, 1);
  cache.clear();
});
