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
  vm.runInNewContext(code, { exports, structuredClone, require: (id) => {
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

test('approval and wrapping report wallet submission while the transaction is still confirming', async () => {
  const hash = '0x1234';
  for (const kind of ['approve', 'wrap']) {
    let releaseReceipt;
    let receiptRequested;
    const awaitingReceipt = new Promise(resolve => { receiptRequested = resolve; });
    const receipt = new Promise(resolve => { releaseReceipt = resolve; });
    const submitted = [];
    let completed = false;
    const mocks = {
      '@tanstack/react-query': { useMutation: ({ mutationFn }) => ({ mutateAsync: mutationFn }) },
      wagmi: {
        useConnection: () => ({ address: '0xaccount', chainId: 56 }),
        useWalletClient: () => ({ data: { chain: { id: 56 }, writeContract: async () => hash } }),
      },
      './use-get-transaction-receipt': { useGetTransactionReceipt: () => () => {
        receiptRequested();
        return receipt;
      } },
      '../utils': { getWrappedNativeCurrency: () => ({ address: '0xwrapped' }) },
      '../abi/wethAbi.json': [],
    };
    const onSubmitted = value => submitted.push(value);
    const operation = kind === 'approve'
      ? load('lib/hooks/use-token-approval.ts', mocks).useApproveToken().mutateAsync({
        tokenAddress: '0xtoken', spenderAddress: '0xspender', amount: '1', onSubmitted,
      })
      : load('lib/hooks/use-wrap.ts', mocks).useWrapNativeToken().mutateAsync({ amount: '1', onSubmitted });
    operation.then(() => { completed = true; });
    await awaitingReceipt;
    assert.deepEqual(submitted, [hash]);
    assert.equal(completed, false, 'submission notification must not skip transaction confirmation');
    releaseReceipt({ status: 'success' });
    assert.equal((await operation).hash, hash);
  }
});

test('swap wallet prompts clear after each wallet response and return for the next request', async () => {
  const { createSwapExecutor } = load('lib/swap/execution.ts', {});
  const account = '0x1111111111111111111111111111111111111111';
  const inputToken = '0x2222222222222222222222222222222222222222';
  const outputToken = '0x3333333333333333333333333333333333333333';
  const hash = '0x' + 'ab'.repeat(32);
  const state = {};
  const waitingStates = [];
  const toastEvents = [];
  state.updateStore = patch => {
    Object.assign(state, patch);
    if ('isAwaitingWallet' in patch) waitingStates.push(patch.isAwaitingWallet);
  };
  let mutation;
  const quote = { user: account, inToken: inputToken, outToken: outputToken, inAmount: '1',
    outAmount: '2', minAmountOut: '1', timestamp: Date.now(), eip712: { domain: { chainId: 56 } } };
  const submitWalletTx = onSubmitted => async () => {
    assert.equal(state.isAwaitingWallet, true);
    onSubmitted(hash);
    assert.equal(state.isAwaitingWallet, false, 'hide while the receipt is pending');
    return { status: 'success' };
  };
  const { useSwapBestTrade } = load('lib/hooks/use-swap-best-trade.tsx', {
    react: { useMemo: fn => fn(), useCallback: fn => fn },
    '@tanstack/react-query': {
      useMutation: options => { mutation = options; return {}; },
      useQueryClient: () => ({}),
    },
    './use-sign-eip': { useSignEip: () => ({ mutateAsync: async () => {
      assert.equal(state.isAwaitingWallet, true);
      return '0xsignature';
    } }) },
    './use-approval': { useApproval: (_spender, _token, _amount, onSubmitted) => ({
      ensureAllowance: async () => false, approve: submitWalletTx(onSubmitted),
    }) },
    './use-wrap': { useWrap: onSubmitted => ({ mutateAsync: submitWalletTx(onSubmitted) }) },
    '../utils': { isNativeAddress: () => true, getWrappedNativeCurrency: () => ({ address: inputToken }) },
    './use-derived-swap': { useDerivedSwap: () => ({ inputCurrency: { address: inputToken }, outputCurrency: { address: outputToken },
      parsedInputAmount: '1', inputAmount: '1', outputAmount: '2', trade: { originalQuote: quote } }) },
    '@/lib/swap/execution': { createSwapExecutor },
    '@/lib/swap/use-swap-toasts': { useSwapToasts: () => new Proxy({}, { get: (_target, name) => () => toastEvents.push(name) }) },
    './liquidity-hub': { useLiquidityHub: () => ({ swap: async () => {
      assert.equal(state.isAwaitingWallet, false, 'hide after signing, before the relay returns a hash');
      return hash;
    } }) },
    './use-get-transaction-receipt': { useGetTransactionReceipt: () => async () => {
      assert.equal(state.isAwaitingWallet, false);
      return { status: 'success' };
    } },
    './store': { useBestTradeSwapStore: Object.assign(selector => selector(state), { getState: () => state }), useSwapStore: selector => selector({ setPauseQuote: () => {} }) },
    '../types': { SwapStep: { WRAP: 'WRAP', APPROVE: 'APPROVE', SWAP: 'SWAP' } },
    wagmi: { useConnection: () => ({ address: account, chainId: 56 }), useWalletClient: () => ({ data: {
      getAddresses: async () => [account], getChainId: async () => 56,
    } }) },
    '../tx-rejection': { isUserRejectedError: () => false },
  });
  useSwapBestTrade();
  await mutation.mutationFn();
  assert.deepEqual(waitingStates, [true, false, true, false, true, false]);
  // Visibility changes after the hook rendered must affect the completion notification.
  for (const isReviewOpen of [true, false, true]) {
    state.isReviewOpen = isReviewOpen;
    toastEvents.length = 0;
    mutation.onSuccess({ txHash: hash });
    assert.deepEqual(toastEvents, [isReviewOpen ? 'dismissPendingToasts' : 'onSwapSuccess']);
    assert.equal(state.status, require('@orbs-network/swap-ui').SwapStatus.SUCCESS);
  }
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
    execution: {}, busy: false, submissions: 0, notices: [], dismissed: [], invalidated: [], mutation: undefined,
  };
  const store = (selector) => selector(state);
  store.setState = (patch) => Object.assign(state, patch);
  store.getState = () => state;
  const hooks = load('components/advanced-order/use-order-execution.ts', {
    '@tanstack/react-query': {
      useQueryClient: () => ({}),
      useMutation: (options) => { state.mutation = options; return { mutate: () => {}, isPending: false }; },
    },
    wagmi: { useConnection: () => state.connection },
    sonner: { toast: {
      error: (title, options) => state.notices.push({ title, ...options }),
      success: (title, options) => state.notices.push({ title, ...options }),
      dismiss: id => state.dismissed.push(id),
    } },
    '@/lib/spot/queries': { invalidateOrderQueries: async (_client, result) => { state.invalidated.push(result); } },
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

test('order completion uses current review visibility and always refreshes orders', () => {
  const f = executionFixture();
  f.useExecution();
  const result = { order: {}, partner: 'partner', chainId: 56, account: '0xaaaa' };
  for (const isReviewOpen of [true, false, true]) {
    f.state.isReviewOpen = isReviewOpen;
    f.state.notices.length = 0;
    f.state.dismissed.length = 0;
    f.state.mutation.onSuccess(result);
    assert.deepEqual(f.state.notices, isReviewOpen ? [] : [{ title: 'Order placed', id: 'create' }]);
    assert.deepEqual(f.state.dismissed, isReviewOpen ? ['create'] : []);
    assert.equal(f.state.invalidated.at(-1), result);
  }
  assert.equal(f.state.invalidated.length, 3);
});

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
    '@/features/order-history/open-orders-notification': { OpenOrdersNotification: () => null },
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

test('open-order notification follows current query data and hides on disconnect', () => {
  let connected = true;
  let orders = [{ status: sdk.OrderStatus.Open }, { status: sdk.OrderStatus.Open }, { status: sdk.OrderStatus.Completed }];
  const { OpenOrdersNotification } = load('features/order-history/open-orders-notification.tsx', {
    'next/link': { default: ({ children, ...props }) => react.createElement('a', props, children), __esModule: true },
    wagmi: { useConnection: () => ({ address: connected ? '0x123' : undefined, isConnected: connected }) },
    '@/lib/hooks/use-form-tab': {
      useSelectedFormTab: () => ({ selectedTab: { value: 'limit' } }),
      preserveFormTabInHref: (href, tab) => `${href}&tab=${tab}`,
    },
    './use-network-orders': { useNetworkOrders: () => ({ data: { orders } }) },
  });
  const render = () => renderToStaticMarkup(react.createElement(OpenOrdersNotification));
  assert.match(render(), /2 open orders/);
  assert.match(render(), /href="\/orders\?filter=open&amp;tab=limit"/);
  orders = [{ status: sdk.OrderStatus.Open }, { status: sdk.OrderStatus.Completed }];
  assert.match(render(), /1 open order</);
  orders = [{ status: sdk.OrderStatus.Cancelled }, { status: sdk.OrderStatus.Completed }];
  assert.equal(render(), '');
  orders = [{ status: sdk.OrderStatus.Open }];
  connected = false;
  assert.equal(render(), '', 'Cached orders must not show after disconnect');
});
