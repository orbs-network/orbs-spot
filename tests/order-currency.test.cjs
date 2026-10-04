/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const ts = require('typescript');
const viem = require('viem');

const token = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';
function fixture(data, isPending = false) {
  const state = {};
  const mocks = {
    react: { useMemo: fn => fn() },
    viem,
    wagmi: { useReadContracts: options => { state.options = options; return { data, isPending }; } },
    '@/lib/consts': { SUPPORTED_CHAINS: [
      { id: 8453, nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 } },
      { id: 56, nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 } },
    ] },
    '@/lib/utils': { isNativeAddress: address => address === viem.zeroAddress, getNativeTokenLogoUrl: chainId => `native-${chainId}` },
  };
  const exports = {};
  const code = ts.transpileModule(readFileSync(resolve(__dirname, '../features/order-history/use-order-currency.ts'), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  new Function('exports', 'require', code)(exports, id => {
    if (!(id in mocks)) throw Error(`Unexpected dependency: ${id}`);
    return mocks[id];
  });
  return { ...exports, state };
}
const success = result => ({ status: 'success', result });
const failure = { status: 'failure', error: new Error('Contract read failed') };

test('history reads only symbol and decimals on the order chain with stable address identity', () => {
  const { useOrderCurrency, state } = fixture([success(6), success('USDC')]);
  const result = useOrderCurrency(token, 8453);
  assert.equal(result.currency.symbol, 'USDC');
  assert.equal(result.currency.decimals, 6);
  assert.equal(result.isLoading, false);
  assert.deepEqual(state.options.contracts.map(call => call.functionName), ['decimals', 'symbol']);
  assert.ok(state.options.contracts.every(call => call.chainId === 8453));
  const first = state.options.contracts;
  useOrderCurrency(viem.getAddress(token), 8453);
  assert.deepEqual(state.options.contracts, first);
  useOrderCurrency(token, 56);
  assert.ok(state.options.contracts.every(call => call.chainId === 56));
});

test('native assets use their own chain metadata without contract reads', () => {
  const { useOrderCurrency, state } = fixture(undefined, true);
  assert.equal(useOrderCurrency(viem.zeroAddress, 8453).currency.symbol, 'ETH');
  assert.equal(state.options.query.enabled, false);
  const bnb = useOrderCurrency(viem.zeroAddress, 56);
  assert.equal(bnb.currency.symbol, 'BNB');
  assert.equal(bnb.currency.decimals, 18);
  assert.equal(bnb.isLoading, false);
});

test('invalid tokens and unsupported chains do not request metadata or stay loading', () => {
  const { useOrderCurrency, state } = fixture(undefined, true);
  for (const [address, chainId] of [[undefined, 8453], ['invalid', 8453], [token, undefined], [token, 123456]]) {
    assert.deepEqual(useOrderCurrency(address, chainId), { currency: undefined, isLoading: false });
    assert.equal(state.options.query.enabled, false);
  }
});

test('contract reads keep skeletons pending and never invent missing decimals', () => {
  assert.equal(fixture(undefined, true).useOrderCurrency(token, 8453).isLoading, true);
  const failed = fixture([failure, success('USDC')]).useOrderCurrency(token, 8453);
  assert.equal(failed.currency, undefined);
  assert.equal(failed.isLoading, false);
  assert.equal(fixture([success(0), success('WHOLE')]).useOrderCurrency(token, 8453).currency.decimals, 0);
});

test('a failed symbol does not discard valid decimals or display the address as a symbol', () => {
  const result = fixture([success(18), failure]).useOrderCurrency(token, 8453);
  assert.equal(result.currency.decimals, 18);
  assert.equal(result.currency.symbol, '');
  assert.equal(result.isLoading, false);
});
