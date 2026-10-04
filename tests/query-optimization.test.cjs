/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const ts = require('typescript');
const { QueryClient, QueryObserver, environmentManager } = require('@tanstack/react-query');
const { OrderStatus } = require('@orbs-network/spot-ui');

function load(file, mocks = {}) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(resolve(__dirname, '..', file), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  new Function('exports', 'require', code)(exports, id => mocks[id] ?? require(id));
  return exports;
}

const { shareOrders, invalidateOrderQueries } = load('lib/spot/queries.ts');
const { watchCancelledOrder } = load('lib/spot/cancel-status.ts', {
  './queries': load('lib/spot/queries.ts'),
});

function cancellationFixture(t, responses) {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });
  const wasServer = environmentManager.isServer();
  environmentManager.setIsServer(() => false);
  const cache = new QueryClient();
  t.after(() => { cache.clear(); environmentManager.setIsServer(() => wasServer); });
  const scope = { partner: 'external', chainId: 8453, account: '0xABCD', historyKey: '2:8453:target' };
  const chainKey = ['spot-orders', 'external', 8453, '0xabcd'];
  const allKey = ['spot-orders', 'external', 'all', '0xabcd'];
  const target = { chainId: 8453, historyKey: scope.historyKey, status: OrderStatus.Open };
  const other = { chainId: 56, historyKey: '2:56:target', status: OrderStatus.Open };
  const requests = [];
  cache.setQueryData(chainKey, [target]);
  cache.setQueryData(allKey, { orders: [target, other], failures: [{ chainId: 56, error: new Error('Other chain failed') }] });
  cache.setQueryData(['spot-client', 'external', 8453], {
    getAccountOrders: async args => {
      requests.push(args);
      const response = responses[requests.length - 1];
      if (response instanceof Error) throw response;
      if (typeof response === 'function') return response(args);
      return response ?? [target];
    },
  });
  const { stop, finished } = watchCancelledOrder(cache, scope);
  t.after(stop);
  const settle = () => new Promise(setImmediate);
  const tick = async () => { t.mock.timers.tick(2_000); await settle(); };
  return { cache, scope, target, other, chainKey, allKey, requests, stop, finished, settle, tick };
}

test('cancellation polls only its original chain until the matching order status changes', async t => {
  const cancelled = { chainId: 8453, historyKey: '2:8453:target', status: OrderStatus.Cancelled };
  const f = cancellationFixture(t, [undefined, undefined, [cancelled]]);
  let finished = false;
  void f.finished.then(() => { finished = true; });
  const otherWalletKey = ['spot-orders', 'external', 'all', '0xbbbb'];
  const otherWallet = { orders: [f.other], failures: [] };
  f.cache.setQueryData(otherWalletKey, otherWallet);
  await f.settle();
  assert.equal(f.requests.length, 1);
  await f.tick();
  assert.equal(f.requests.length, 2);
  assert.equal(finished, false);
  assert.equal(f.cache.getQueryData(f.allKey).orders.find(order => order.historyKey === f.target.historyKey).status, OrderStatus.Open);
  await f.tick();
  assert.equal(f.requests.length, 3);
  assert.equal(finished, true);
  assert.equal(f.cache.getQueryData(f.chainKey)[0].status, OrderStatus.Cancelled);
  const merged = f.cache.getQueryData(f.allKey);
  assert.equal(merged.orders.find(order => order.historyKey === f.target.historyKey).status, OrderStatus.Cancelled);
  assert.equal(merged.orders.find(order => order.chainId === 56), f.other);
  assert.equal(merged.failures[0].chainId, 56);
  assert.equal(f.cache.getQueryData(otherWalletKey), otherWallet);
  assert.ok(f.requests.every(request => request.account === '0xABCD' && request.getv1orders === false));
  assert.equal(f.cache.getQueryCache().find({ queryKey: f.chainKey }).getObserversCount(), 0);
  await f.tick();
  await f.tick();
  assert.equal(f.requests.length, 3);
});

test('cancellation keeps polling after errors, missing orders, and unrelated status changes', async t => {
  const cancelled = { chainId: 8453, historyKey: '2:8453:target', status: OrderStatus.Cancelled };
  const unrelated = { ...cancelled, historyKey: '2:8453:other' };
  const f = cancellationFixture(t, [new Error('Indexer unavailable'), [], [unrelated], [cancelled]]);
  await f.settle();
  await f.tick();
  await f.tick();
  assert.equal(f.requests.length, 3);
  assert.equal(f.cache.getQueryData(f.allKey).orders[0].status, OrderStatus.Open);
  await f.tick();
  assert.equal(f.cache.getQueryData(f.allKey).orders.find(order => order.historyKey === cancelled.historyKey).status, OrderStatus.Cancelled);
  await f.tick();
  assert.equal(f.requests.length, 4);
});

test('cancellation also stops if execution wins the race and completes the order', async t => {
  const completed = { chainId: 8453, historyKey: '2:8453:target', status: OrderStatus.Completed };
  const f = cancellationFixture(t, [[completed]]);
  await f.settle();
  assert.equal(f.cache.getQueryData(f.allKey).orders.find(order => order.historyKey === completed.historyKey).status, OrderStatus.Completed);
  await f.tick();
  assert.equal(f.requests.length, 1);
});

test('clearing the cache stops cancellation polling and aborts its pending read', async t => {
  const f = cancellationFixture(t, [({ signal }) => new Promise((_, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  })]);
  await f.settle();
  assert.equal(f.requests.length, 1);
  f.cache.clear();
  assert.equal(f.requests[0].signal.aborted, true);
  await f.tick();
  assert.equal(f.requests.length, 1);
  await f.finished;
});

test('cancellation status matches the exact wallet, chain, partner and history identity', async t => {
  const cache = new QueryClient();
  t.after(() => cache.clear());
  let partner = 'external';
  const { useOrderCancelling } = load('lib/spot/use-order-cancelling.ts', {
    '@tanstack/react-query': { useMutationState: ({ filters, select }) => cache.getMutationCache().findAll(filters).map(select) },
    '@/lib/partners/spot': { getActiveSpotPartner: () => partner },
    './queries': load('lib/spot/queries.ts'),
  });
  const order = { status: OrderStatus.Open, chainId: 56, maker: '0xABCD', historyKey: '2:56:target' };
  let finish = () => {};
  const refresh = new Promise(resolve => { finish = resolve; });
  t.after(finish);
  const mutation = cache.getMutationCache().build(cache, {
    mutationKey: ['spot-cancellation', 'external', 56, '0xabcd', order.historyKey],
    mutationFn: async () => 'confirmed',
    onSuccess: () => refresh,
  });
  const pending = mutation.execute();
  assert.equal(useOrderCancelling(order), true);
  await new Promise(setImmediate);
  assert.equal(useOrderCancelling(order), true, 'still pending while history refresh catches up');
  for (const other of [undefined, { ...order, maker: '0xother' }, { ...order, chainId: 8453 }, { ...order, historyKey: 'another-order' }, { ...order, status: OrderStatus.Cancelled }]) {
    assert.equal(useOrderCancelling(other), false);
  }
  partner = 'another-partner';
  assert.equal(useOrderCancelling(order), false);
  partner = 'external';
  finish();
  await pending;
  assert.equal(useOrderCancelling(order), false);

  const failed = cache.getMutationCache().build(cache, {
    mutationKey: mutation.options.mutationKey,
    mutationFn: async () => { throw new Error('User rejected'); },
    retry: false,
  });
  const rejected = failed.execute();
  assert.equal(useOrderCancelling(order), true);
  await assert.rejects(rejected, /User rejected/);
  assert.equal(useOrderCancelling(order), false);
});

test('unchanged history polls preserve the list and changed rows alone get new identities', () => {
  const orders = [{ historyKey: 'a', progress: 0 }, { historyKey: 'b', progress: 0 }];
  assert.equal(shareOrders(orders, orders.map(order => ({ ...order }))), orders);
  const updated = shareOrders(orders, [{ ...orders[0], progress: 50 }, { ...orders[1] }]);
  assert.notEqual(updated, orders);
  assert.notEqual(updated[0], orders[0]);
  assert.equal(updated[1], orders[1]);
});

test('cache refresh failures cannot turn a confirmed order write into a rejected mutation', async () => {
  const keys = [];
  const result = await invalidateOrderQueries({ invalidateQueries: async ({ queryKey }) => {
    keys.push(queryKey);
    if (queryKey[0] === 'balances') throw new Error('Balance endpoint unavailable');
  } }, { partner: 'external', chainId: 8453, account: '0xABCD' });
  assert.equal(result.filter(item => item.status === 'fulfilled').length, 2);
  assert.ok(keys.every(key => key.at(-1) === '0xabcd'));
  assert.ok(keys.some(key => key[2] === 'all'));
  assert.ok(keys.some(key => key[2] === 8453));
});

function currenciesFixture() {
  const state = { custom: [], remote: [{ address: '0x1', symbol: 'ONE' }], reads: 0 };
  const hooks = load('lib/hooks/use-currencies-query.ts', {
    react: { useMemo: fn => fn() },
    '@tanstack/react-query': { queryOptions: options => options, useQuery: options => {
      state.options = options;
      return { data: state.remote };
    } },
    '../consts': { DEFAULT_CHAIN_ID: 56 },
    '../get-currencies': { getCurrencies: async () => { state.reads++; return state.remote; } },
    '../utils': { dedupeCurrenciesByAddress: values => [...new Map(values.map(value => [value.address, value])).values()] },
    './store': { useUserStore: selector => selector({ customCurrencies: { 56: state.custom } }) },
    './use-data-chain-id': { useDataChainId: () => 56 },
  });
  return { state, ...hooks };
}

test('imported token edits merge immediately while all observers reuse the remote token list', async t => {
  const { state, useCurrenciesQuery } = currenciesFixture();
  const cache = new QueryClient();
  t.after(() => cache.clear());
  const first = useCurrenciesQuery();
  await cache.fetchQuery(state.options);
  state.custom = [{ address: '0x2', symbol: 'TWO' }];
  const imported = useCurrenciesQuery();
  await cache.fetchQuery(state.options);
  assert.equal(state.reads, 1);
  assert.equal(first.data.length, 1);
  assert.equal(imported.data.length, 2);
  state.custom = [{ address: '0x2', symbol: 'UPDATED' }];
  assert.equal(useCurrenciesQuery().data[1].symbol, 'UPDATED');
  await cache.fetchQuery(state.options);
  assert.equal(state.reads, 1);
  assert.equal(cache.getQueryCache().getAll().length, 1);
});

function quoteFixture() {
  const state = { paused: false, account: '0xabc', requests: 0, swap: true };
  const { useTrade } = load('lib/hooks/use-trade.ts', {
    react: { useMemo: fn => fn() },
    '@tanstack/react-query': { useQuery: options => { state.options = options; return {}; } },
    './liquidity-hub': { useLiquidityHub: () => ({ getQuote: async () => {
      state.requests++;
      return { outAmount: '10', inAmount: '5', minAmountOut: '9' };
    } }) },
    './use-settings': { useSettings: () => ({ slippage: 0.5 }) },
    '../utils': { isNativeAddress: () => false },
    './use-data-chain-id': { useDataChainId: () => 56 },
    '@/lib/hooks/use-developer-mode': { useDeveloperMode: () => ({ isDeveloperMode: false }) },
    './use-developer-mode': {},
    wagmi: { useConnection: () => ({ chainId: 56, address: state.account }) },
    './store': { useSwapStore: selector => selector({ pauseQuote: state.paused }) },
    './use-form-tab': { useIsSwapTab: () => state.swap },
  });
  return { state, render: () => useTrade({ address: 'input' }, { address: 'output' }, '5') };
}

test('quote observers reuse fresh data and pause automatic reads during execution', async t => {
  const { state, render } = quoteFixture();
  const cache = new QueryClient();
  t.after(() => cache.clear());
  render();
  await cache.fetchQuery(state.options);
  const observer = new QueryObserver(cache, state.options);
  const unsubscribe = observer.subscribe(() => {});
  t.after(unsubscribe);
  assert.equal(state.requests, 1);
  state.paused = true;
  render();
  assert.equal(state.options.enabled, false);
  assert.equal(state.options.refetchInterval({ state: {} }), false);
  // The executor may still explicitly refresh an expired quote while polling is paused.
  observer.setOptions(state.options);
  await observer.refetch();
  assert.equal(state.requests, 2);
});

test('quotes cannot fetch without an account, and order tabs disable swap quotes', async () => {
  const { state, render } = quoteFixture();
  state.account = undefined;
  render();
  assert.equal(state.options.enabled, false);
  await assert.rejects(state.options.queryFn({ signal: new AbortController().signal }), /Connect a wallet/);
  assert.equal(state.requests, 0);
  state.account = '0xabc';
  state.swap = false;
  render();
  assert.equal(state.options.enabled, false);
});
