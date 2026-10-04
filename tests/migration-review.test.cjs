/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');
const sdk = require('@orbs-network/spot-ui');
const react = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function load(file, dependencies) {
  const exports = {};
  const source = fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, { exports, require: (id) => {
    if (Object.hasOwn(dependencies, id)) return dependencies[id];
    if (id === '@/lib/spot/queries') return load('lib/spot/queries.ts', {});
    if (id.startsWith('.') || id.startsWith('@/')) throw new Error(`Unmocked dependency: ${id}`);
    return require(id);
  } });
  return exports;
}

test('missing approval amount rejects before an execution allowance read', async () => {
  let reads = 0;
  const { useApproval } = load('lib/hooks/use-approval.ts', {
    react: { useCallback: (fn) => fn },
    '@tanstack/react-query': { useMutation: () => ({}) },
    './common': { useParseNativeCurrencyAddress: (value) => value },
    './use-token-approval': { useApproveToken: () => ({}) },
    './use-token-allowance': {
      useTokenAllowance: () => ({ data: '10', isLoading: false }),
      useGetTokenAllowance: () => async () => { reads++; return '10'; },
    },
  });
  await assert.rejects(useApproval('spender', 'token').ensureAllowance(), /Missing required allowance amount/);
  await assert.rejects(useApproval('spender', 'token', '').ensureAllowance(), /Missing required allowance amount/);
  assert.equal(reads, 0);
  assert.equal(await useApproval('spender', 'token', '9').ensureAllowance(), true);
  assert.equal(await useApproval('spender', 'token', '11').ensureAllowance(), false);
  assert.equal(reads, 2);
});

function historyFixture() {
  const state = { orders: [], address: '0xaaaa', chainId: 56, open: false, refetches: 0, notifications: [], queries: [], invalidated: [], cancellationWatches: [], mutation: undefined };
  const previous = { current: undefined };
  const hooks = load('components/advanced-order/use-order-client.ts', {
    react: { useMemo: (fn) => fn(), useRef: () => previous, useEffect: (fn) => fn() },
    '@tanstack/react-query': { useQuery: (options) => {
      state.queries.push(options);
      return { data: options.queryKey[0] === 'spot-orders' ? state.orders : {} };
    },
      useQueryClient: () => ({ invalidateQueries: async ({ queryKey }) => { state.invalidated.push(Array.from(queryKey)); } }),
      useMutation: options => { state.mutation = options; return {}; },
    },
    wagmi: { useConnection: () => ({ address: state.address }) },
    sonner: { toast: { success: (message) => state.notifications.push(message) } },
    '@/lib/hooks/use-data-chain-id': { useDataChainId: () => state.chainId },
    '@/lib/consts': { SPOT_CHAINS: [{ id: 56 }, { id: 4663 }] },
    '@/lib/hooks/store': { useFormTabStore: (selector) => selector({ orderHistoryOpen: state.open }) },
    '@/lib/partners/spot': { getActiveSpotPartner: () => 'partner' },
    '@/lib/spot/cancel-status': { watchCancelledOrder: (_, scope) => {
      state.cancellationWatches.push(scope);
      return { finished: state.refreshFinished ?? Promise.resolve() };
    } },
    '@/lib/spot/use-order-cancelling': { useOrderCancelling: () => false },
    '@/lib/spot/cancellation': {}, '@/lib/spot/history': {}, '@/lib/tx-rejection': {}, './constants': {}, './hooks': { useWalletInteractions: () => ({}) },
    '@/lib/hooks/use-balances': { useBalances: () => ({ refetch: async () => { state.refetches++; } }) },
  });
  return { state, ...hooks };
}

test('one history update refreshes balances once even when multiple orders fill', () => {
  const f = historyFixture();
  f.state.orders = ['first', 'second'].map((historyKey) => ({ historyKey, status: sdk.OrderStatus.Open, srcAmountFilled: '0' }));
  f.useHistoryNotifications(f.state.orders);
  assert.equal(f.state.refetches, 0);
  f.state.orders = f.state.orders.map((order) => ({ ...order, status: sdk.OrderStatus.Completed, srcAmountFilled: '100' }));
  f.useHistoryNotifications(f.state.orders);
  assert.equal(f.state.refetches, 1);
  assert.equal(f.state.notifications.length, 2);
  f.useHistoryNotifications(f.state.orders);
  assert.equal(f.state.refetches, 1);
  assert.equal(f.state.notifications.length, 2);
  f.state.address = '0xbbbb';
  f.state.orders = f.state.orders.map((order) => ({ ...order, srcAmountFilled: '200' }));
  f.useHistoryNotifications(f.state.orders);
  assert.equal(f.state.refetches, 1);
});

test('history cache keys match the request scope and polling stays limited to the open panel', () => {
  const f = historyFixture();
  f.useOrders();
  let query = f.state.queries.at(-1);
  assert.deepEqual(Array.from(query.queryKey), ['spot-orders', 'partner', 56, '0xaaaa']);
  assert.equal(query.refetchInterval, false);
  f.state.open = true;
  f.useOrders();
  query = f.state.queries.at(-1);
  assert.equal(query.refetchInterval, 10_000);
  assert.equal(query.refetchIntervalInBackground, false);
});

test('all-network history disables redundant single-network reads', () => {
  const f = historyFixture();
  f.useOrders(false);
  assert.ok(f.state.queries.every(query => query.enabled === false));
});

test('confirmed cancellation watches the original order scope even after the wallet changes', async () => {
  const f = historyFixture();
  f.useCancelOrder({ chainId: 8453 });
  f.state.address = '0xBBBB';
  f.state.chainId = 56;
  const result = { chainId: 8453, partner: 'partner', account: '0xABCD', historyKey: '2:8453:order' };
  await f.state.mutation.onSuccess(result);
  assert.deepEqual(f.state.cancellationWatches, [result]);
  assert.deepEqual(f.state.invalidated, [
    ['balances', 8453, '0xabcd'],
  ]);
});

test('cancellation loading waits for the status refresh to finish', async () => {
  const f = historyFixture();
  let finish = () => {};
  f.state.refreshFinished = new Promise(resolve => { finish = resolve; });
  f.useCancelOrder({ chainId: 56, historyKey: '2:56:target' });
  assert.deepEqual(Array.from(f.state.mutation.mutationKey), ['spot-cancellation', 'partner', 56, '0xaaaa', '2:56:target']);
  let settled = false;
  const success = f.state.mutation.onSuccess({ chainId: 56, partner: 'partner', account: '0xaaaa', historyKey: '2:56:target' }).then(() => { settled = true; });
  await Promise.resolve();
  assert.equal(settled, false);
  finish();
  await success;
  assert.equal(settled, true);
});

test('swap-only networks do not initialize an unsupported advanced-order client', () => {
  const f = historyFixture();
  for (const [chainId, enabled] of [[56, true], [4663, true], [1101, false], [250, false], [81457, false]]) {
    f.state.chainId = chainId;
    f.useClient();
    assert.equal(f.state.queries.at(-1).enabled, enabled);
    assert.equal(f.state.queries.at(-1).queryKey[2], chainId);
  }
});

function executionFixture() {
  const state = {
    connection: { address: '0xaaaa', chainId: 56 }, client: { data: { partner: 'partner' } },
    model: { form: { canSubmit: true }, inputToken: {}, outputToken: {}, market: { isLoading: false, noLiquidity: false } },
    execution: {}, busy: false, submissions: 0, notices: [], mutation: undefined,
  };
  const store = (selector) => selector(state);
  store.setState = (patch) => Object.assign(state, patch);
  const hooks = load('components/advanced-order/use-order-execution.ts', {
    '@tanstack/react-query': {
      useQueryClient: () => ({}),
      useMutation: (options) => { state.mutation = options; return { mutate: () => {}, isPending: false }; },
    },
    wagmi: { useConnection: () => state.connection },
    sonner: { toast: { error: (title, options) => state.notices.push({ title, ...options }) } },
    './constants': { CREATE_ORDER_TOAST_ID: 'create' },
    '@/lib/hooks/store': { useOrderSubmitFlowStore: store },
    '@/lib/utils': { getWrappedNativeCurrency: () => ({}) },
    '@/lib/spot/execution': {
      ExecutionStatus: { LOADING: 1 }, ExecutionPhase: { REJECTED: 'rejected' },
      createOrderExecutor: () => ({ isBusy: () => state.busy, submit: async () => { state.submissions++; return {}; }, reset: () => {} }),
    },
    './use-order-form': { useOrderModel: () => state.model },
    './use-order-client': { useClient: () => state.client },
    './hooks': { useWalletInteractions: () => ({}) },
  });
  return { state, ...hooks };
}

test('submission preflight failures reject visibly without executing or succeeding', async () => {
  const cases = [
    [(s) => { s.busy = true; }, /already being submitted/],
    [(s) => { s.connection.address = undefined; }, /Connect a wallet/],
    [(s) => { s.client.data = undefined; }, /configuration is not ready/],
    [(s) => { s.model.inputToken = undefined; }, /Select both tokens/],
    [(s) => { s.model.market.isLoading = true; }, /Wait for market data/],
    [(s) => { s.model.market.noLiquidity = true; }, /No liquidity/],
    [(s) => { s.model.form.canSubmit = false; }, /Resolve the order inputs/],
  ];
  for (const [change, message] of cases) {
    const f = executionFixture();
    change(f.state);
    f.useExecution();
    await assert.rejects(f.state.mutation.mutationFn(), (error) => {
      assert.match(error.message, message);
      f.state.mutation.onError(error);
      return true;
    });
    assert.equal(f.state.submissions, 0);
    assert.equal(f.state.notices.length, 1);
    assert.equal(f.state.notices[0].title, 'Order not submitted');
  }
});

test('the shared execution state disables every submit button while an order is running', () => {
  const f = executionFixture();
  assert.equal(f.useSubmitButton().disabled, false);
  f.state.execution = { status: 1 };
  assert.equal(f.useSubmitButton().disabled, true);
});

test('Swap does not mount the advanced form or its subscriptions', () => {
  let selectedTab = 'swap';
  let mounts = 0;
  let historyMounts = 0;
  let historyOpen = false;
  let partnerId = 'playground';
  const { TradingForm } = load('components/trading-form.tsx', {
    '@/components/advanced-order-form': { AdvancedOrderForm: () => { mounts++; return null; } },
    '@/components/best-trade-form': { SwapBestTradeForm: () => null },
    '@/components/form-container': { FormContainer: ({ children }) => children },
    '@/components/order-history-modal': { OrderHistoryModal: () => { historyMounts++; return null; } },
    '@/components/trading-sidebar': { TradingSidebar: () => null },
    '@/lib/hooks/store': { useFormTabStore: (select) => select({ orderHistoryOpen: historyOpen, setOrderHistoryOpen: () => {} }) },
    '@/lib/partners/client': { get IS_ORBS() { return partnerId === 'orbs'; } },
    '@/lib/hooks/use-form-tab': { useSelectedFormTab: () => ({ selectedTab: { value: selectedTab } }) },
    '@/lib/types': { FormTab: { SWAP: 'swap' } },
  });
  renderToStaticMarkup(react.createElement(TradingForm));
  assert.equal(mounts, 0);
  assert.equal(historyMounts, 0);
  historyOpen = true;
  renderToStaticMarkup(react.createElement(TradingForm));
  assert.equal(mounts, 0);
  assert.equal(historyMounts, 1);
  historyOpen = false;
  selectedTab = 'twap';
  renderToStaticMarkup(react.createElement(TradingForm));
  assert.equal(mounts, 1);
  assert.equal(historyMounts, 2);
  partnerId = 'orbs';
  historyOpen = true;
  renderToStaticMarkup(react.createElement(TradingForm));
  assert.equal(historyMounts, 2, 'Orbs history is a page and must never mount the modal');
});


test('history shows an unknown amount as a placeholder while preserving actual zero', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../features/order-history/format.ts'), 'utf8');
  const ast = ts.createSourceFile('history.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const formatter = ast.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === 'formatTokenValue');
  const compiled = ts.transpileModule(formatter.getText(ast).replace(/^export /, ""), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const format = new Function('formatDisplayNumber', `${compiled}; return formatTokenValue;`)((value) => value);
  assert.equal(format('', 'USDC'), '-');
  assert.equal(format(undefined, 'USDC'), '-');
  assert.equal(format('0', 'USDC'), '0 USDC');
  assert.equal(format('1.5', 'USDC'), '1.5 USDC');
});
