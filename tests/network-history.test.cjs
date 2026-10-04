/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const ts = require('typescript');
const { QueryClient, replaceEqualDeep } = require('@tanstack/react-query');

function load(file, mocks) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(resolve(__dirname, '..', file), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  new Function('exports', 'require', code)(exports, name => mocks[name] ?? require(name));
  return exports;
}

function fixture(t) {
  const queryClient = new QueryClient();
  t.after(() => queryClient.clear());
  const state = { address: '0xABCD', partner: 'external', options: undefined, clients: [], requests: [], failChain: undefined };
  const mocks = {
    '@tanstack/react-query': {
      useQueryClient: () => queryClient,
      useQuery: options => { state.options = options; return {}; },
      replaceEqualDeep,
    },
    '@orbs-network/spot-ui': { createClient: async (partner, chainId, options) => {
      state.clients.push({ partner, chainId, options });
      return { getAccountOrders: async ({ account, signal, getv1orders }) => {
        assert.equal(getv1orders, false);
        state.requests.push({ account, chainId, signal });
        if (chainId === state.failChain || state.failChain === 'all') throw new Error('Network unavailable');
        return [{ historyKey: `2:${chainId}:same-hash`, chainId }];
      } };
    } },
    wagmi: { useConnection: () => ({ address: state.address }) },
    '@/lib/consts': { SPOT_CHAINS: [{ id: 56 }, { id: 8453 }] },
    '@/lib/partners/spot': { getActiveSpotPartner: () => state.partner },
  };
  mocks['@/lib/spot/queries'] = load('lib/spot/queries.ts', { '@orbs-network/spot-ui': mocks['@orbs-network/spot-ui'] });
  const { useNetworkOrders } = load('features/order-history/use-network-orders.ts', mocks);
  return { state, useNetworkOrders, queryClient };
}

test('all-network history keys isolate wallets, partners, and chains without a connected-chain dependency', t => {
  const { state, useNetworkOrders } = fixture(t);
  useNetworkOrders(true);
  assert.deepEqual(state.options.queryKey, ['spot-orders', 'external', 'all', '0xabcd']);
  state.address = '0xEF12';
  state.partner = 'ginco';
  useNetworkOrders(true);
  assert.deepEqual(state.options.queryKey, ['spot-orders', 'ginco', 'all', '0xef12']);
  assert.equal(state.options.refetchIntervalInBackground, false);
  useNetworkOrders(false);
  assert.equal(state.options.enabled, false);
  state.address = undefined;
  useNetworkOrders(true);
  assert.equal(state.options.enabled, false);
});

test('network failures do not discard successful chains and retry reuses initialized clients', async t => {
  const { state, useNetworkOrders } = fixture(t);
  state.failChain = 8453;
  useNetworkOrders(true);
  const signal = new AbortController().signal;
  const results = await state.options.queryFn({ signal });
  assert.deepEqual(results.orders.map(order => order.chainId), [56]);
  assert.equal(results.failures[0].chainId, 8453);
  assert.equal(results.failures[0].error.message, 'Network unavailable');
  state.failChain = undefined;
  const retried = await state.options.queryFn({ signal });
  assert.deepEqual(retried.orders.map(order => order.chainId), [56, 8453]);
  assert.equal(retried.failures.length, 0);
  assert.equal(state.clients.length, 2);
  assert.ok(state.clients.every(client => client.options.disableAnalytics === true));
  assert.ok(state.requests.every(r => r.account === '0xABCD' && r.signal === signal));
});

test('abandoning a wallet read cancels it before requesting account orders', async t => {
  const { state, useNetworkOrders } = fixture(t);
  useNetworkOrders(true);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(state.options.queryFn({ signal: controller.signal }), { name: 'AbortError' });
  assert.equal(state.requests.length, 0);
});

test('unchanged order objects retain identity when polling changes their position', t => {
  const { state, useNetworkOrders } = fixture(t);
  useNetworkOrders(true);
  const previous = [{ historyKey: 'a', value: 1 }, { historyKey: 'b', value: 2 }];
  const next = state.options.structuralSharing({ orders: previous, failures: [] }, { orders: [{ ...previous[1] }, { ...previous[0] }], failures: [] }).orders;
  assert.equal(next[0], previous[1]);
  assert.equal(next[1], previous[0]);
});

test('history reuses cached clients by partner and chain and disables analytics on new clients', async t => {
  const { state, useNetworkOrders, queryClient } = fixture(t);
  let cachedReads = 0;
  queryClient.setQueryData(['spot-client', 'external', 56], {
    getAccountOrders: async () => { cachedReads++; return []; },
  });
  useNetworkOrders(true);
  const data = await state.options.queryFn({ signal: new AbortController().signal });
  assert.equal(cachedReads, 1);
  assert.equal(data.failures.length, 0);
  assert.equal(state.clients.length, 1);
  assert.equal(state.clients[0].chainId, 8453);
  assert.ok(state.clients.every(client => client.options.disableAnalytics === true));
});

test('all-network failure remains distinguishable from an empty history', async t => {
  const { state, useNetworkOrders } = fixture(t);
  state.failChain = 'all';
  useNetworkOrders(true);
  const data = await state.options.queryFn({ signal: new AbortController().signal });
  assert.equal(data.orders.length, 0);
  assert.deepEqual(data.failures.map(failure => failure.chainId), [56, 8453]);
});

test('aborting while network requests are settling rejects the entire query', async t => {
  const { state, useNetworkOrders } = fixture(t);
  useNetworkOrders(true);
  const controller = new AbortController();
  const request = state.options.queryFn({ signal: controller.signal });
  controller.abort();
  await assert.rejects(request, { name: 'AbortError' });
});

test('history token metadata and fallback contract reads use the order network', () => {
  const reads = [];
  const { useCurrency } = load('lib/hooks/use-currencies.ts', {
    react: { useMemo: fn => fn() },
    '../utils': { getTokenKey: address => address?.toLowerCase(), isNativeAddress: () => false },
    './use-data-chain-id': { useDataChainId: () => 56 },
    './use-currencies-query': { useCurrenciesQuery: chainId => ({ data: chainId === 8453 ? [{ address: '0x1111111111111111111111111111111111111111', symbol: 'USDC', decimals: 6 }] : [], isLoading: false }) },
    wagmi: { useReadContracts: options => { reads.push(options); return {}; } },
    './use-balances': {}, './use-usd-price': {},
  });
  const currency = useCurrency('0x1111111111111111111111111111111111111111', 8453);
  assert.equal(currency.decimals, 6);
  useCurrency('0x2222222222222222222222222222222222222222', 8453);
  assert.ok(reads.at(-1).contracts.every(contract => contract.chainId === 8453));
  assert.equal(reads.at(-1).query.enabled, true);
});
