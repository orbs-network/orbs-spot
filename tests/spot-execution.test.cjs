/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');
const sdk = require('@orbs-network/spot-ui');
function load(name) {
  const source = fs.readFileSync(path.resolve(__dirname, '../lib/spot', name + '.ts'), 'utf8');
  const exports = {};
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText,
    { exports, require, structuredClone, setTimeout: (callback) => setTimeout(callback, 0) });
  return exports;
}
const { createOrderExecutor, ExecutionPhase } = load('execution');
const { describeOrder } = load('history');
const account = '0x1111111111111111111111111111111111111111';
const erc20 = { address: '0x2222222222222222222222222222222222222222', decimals: 6, symbol: 'USDC' };
const output = { address: '0x3333333333333333333333333333333333333333', decimals: 18, symbol: 'OUT' };
function fixture({ native = false, allowance = '0' } = {}) {
  const events = [];
  const snapshots = [];
  let approved = false;
  const form = sdk.calculateOrderForm({ module: sdk.Module.TWAP, inputTokenDecimals: 6, outputTokenDecimals: 18,
    quotedOutputAmountRaw: '100000000000000000000', inputTokenUsdPrice: '1', outputTokenUsdPrice: '1', inputBalanceRaw: '1000000000',
    minTradeSizeUsd: 5, priceProtectionPercent: 3, userInput: { inputAmountUi: '100', isMarketOrder: true, tradeCount: 2 } });
  assert.equal(form.canSubmit, true);
  const preparedOrder = { nonce: 'fresh' };
  const order = { historyKey: 'v2:137:1', id: '1' };
  const wallet = {
    assertContext: async () => events.push('context'),
    getAllowance: async () => { events.push('allowance'); return approved ? form.values.inputAmount : allowance; },
    wrapNativeToken: async (amount) => { events.push(['wrap', amount]); return '0xwrap'; },
    approveToken: async (request) => { events.push(['approve', request]); approved = true; return '0xapprove'; },
    signOrder: async () => { events.push('sign'); return '0xoriginal'; },
    cancelOrder: async () => '0xcancel',
  };
  const client = {
    chainId: 137, spenderAddress: account,
    prepareOrder: (request) => { events.push(['prepare', request]); return { order: preparedOrder, signingRequest: {} }; },
    submitOrder: async (value, signature) => { events.push(['submit', value, signature]); return order; },
  };
  const input = { client, wallet, form, account, inputToken: native ? { ...erc20, address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' } : erc20, outputToken: output, wrappedNativeToken: erc20 };
  const executor = createOrderExecutor((value) => snapshots.push(value));
  return { input, executor, events, snapshots, order, preparedOrder };
}

test('SDK execution confirms wrap and exact approval before preparing, preserving the signature', async () => {
  const f = fixture({ native: true });
  assert.equal(await f.executor.submit(f.input), f.order);
  const steps = f.events.filter(Array.isArray);
  assert.deepEqual(steps.map(([step]) => step), ['wrap', 'approve', 'prepare', 'submit']);
  assert.equal(steps[1][1].amount, f.input.form.values.inputAmount);
  assert.equal(steps[1][1].spenderAddress, account);
  assert.equal(steps[2][1].inputTokenAddress, erc20.address);
  assert.equal(steps[3][1], f.preparedOrder);
  assert.equal(steps[3][2], '0xoriginal');
  assert.equal(f.snapshots.at(-1).phase, ExecutionPhase.SUCCESS);
});

test('sufficient allowance skips approval and native wrapping is never used for ERC20', async () => {
  const f = fixture({ allowance: '999999999999' });
  await f.executor.submit(f.input);
  assert.deepEqual(f.events.filter(Array.isArray).map(([step]) => step), ['prepare', 'submit']);
});

test('invalid calculation stops before any wallet call', async () => {
  const f = fixture();
  f.input.form.canSubmit = false;
  await assert.rejects(f.executor.submit(f.input), /Resolve/);
  assert.equal(f.events.length, 0);
});

test('wallet context changes stop execution before preparation or signing', async () => {
  const f = fixture();
  f.input.wallet.assertContext = async () => { throw new Error('Wallet changed'); };
  await assert.rejects(f.executor.submit(f.input), /Wallet changed/);
  assert.equal(f.events.length, 0);
});

test('concurrent clicks and reset cannot interrupt an active submission', async () => {
  const f = fixture();
  const gate = Promise.withResolvers();
  f.input.wallet.getAllowance = () => gate.promise;
  const pending = f.executor.submit(f.input);
  await Promise.resolve();
  await assert.rejects(f.executor.submit(f.input), /already/);
  assert.equal(f.executor.reset(), false);
  gate.resolve('999999999999');
  await pending;
  assert.equal(f.executor.reset(), true);
});

test('form edits during a pending allowance read cannot alter the captured order', async () => {
  const f = fixture();
  const gate = Promise.withResolvers();
  f.input.wallet.getAllowance = () => gate.promise;
  const pending = f.executor.submit(f.input);
  await Promise.resolve();
  const amount = f.input.form.values.inputAmount;
  f.input.form.values.inputAmount = '7';
  gate.resolve('999999999999');
  await pending;
  assert.equal(f.events.find((event) => event[0] === 'prepare')[1].form.values.inputAmount, amount);
});

test('approval indexing retries are bounded and do not prepare an underfunded allowance', async () => {
  const f = fixture();
  f.input.wallet.getAllowance = async () => { f.events.push('allowance'); return '0'; };
  await assert.rejects(f.executor.submit(f.input), /allowance/);
  assert.equal(f.events.filter((event) => event === 'allowance').length, 5);
  assert.equal(f.events.some((event) => event[0] === 'prepare'), false);
});

test('completed wrapping survives a rejected signature and is not repeated on retry', async () => {
  const f = fixture({ native: true });
  f.input.wallet.signOrder = async () => { throw { code: 4001, message: 'User rejected' }; };
  await assert.rejects(f.executor.submit(f.input));
  assert.equal(f.snapshots.at(-1).phase, ExecutionPhase.REJECTED);
  f.executor.reset();
  f.input.wallet.signOrder = async () => '0xoriginal';
  await f.executor.submit(f.input);
  assert.equal(f.events.filter((event) => event[0] === 'wrap').length, 1);
});

test('ambiguous submission fails once with a history reconciliation message', async () => {
  const f = fixture();
  let calls = 0;
  f.input.client.submitOrder = async () => { calls++; throw new Error('Network interrupted'); };
  await assert.rejects(f.executor.submit(f.input));
  assert.equal(calls, 1);
  assert.match(f.snapshots.at(-1).error.message, /Check order history before retrying/);
});

test('history display formats raw units and retains identity across colliding protocol ids', () => {
  const order = { version: 2, id: '1', historyKey: 'contract-a:1', type: sdk.OrderType.TWAP_MARKET,
    srcAmount: '1000000', srcAmountPerTrade: '500000', dstMinAmountPerTrade: '0', srcAmountFilled: '500000', dstAmountFilled: '1000000000000000000',
    fillDelay: 60000, fills: [{ inAmount: '500000', outAmount: '1000000000000000000', timestamp: 123, txHash: '0xfill' }] };
  const first = describeOrder(order, erc20, output);
  const second = describeOrder({ ...order, historyKey: 'contract-b:1' }, erc20, output);
  assert.equal(first.inputAmount.ui, '1');
  assert.equal(first.outputAmountFilled.ui, '1');
  assert.equal(first.tradeInterval, 60000);
  assert.equal(first.fills[0].inputAmount.ui, '0.5');
  assert.notEqual(first.original.historyKey, second.original.historyKey);
  assert.equal(first.original.id, second.original.id);
  assert.equal(describeOrder(order).inputAmount.ui, '');
});

test('cancellation forwards the SDK request and waits for the confirmed wallet write', async () => {
  const { cancelOrder } = load('cancellation');
  for (const version of [1, 2]) {
    const f = fixture();
    const order = { version, historyKey: `v${version}:137:1`, maker: account, chainId: 137 };
    const request = { order, contractAddress: erc20.address, abi: [], args: version === 1 ? ['1'] : [['0xdigest']] };
    f.input.client.getCancelOrderRequest = (value) => { assert.equal(value, order); return request; };
    const gate = Promise.withResolvers();
    f.input.wallet.cancelOrder = (value) => { assert.equal(value, request); return gate.promise; };
    const pending = cancelOrder(f.input.client, f.input.wallet, order, account);
    await assert.rejects(cancelOrder(f.input.client, f.input.wallet, order, account), /already pending/);
    gate.resolve('0xconfirmed');
    assert.equal(await pending, '0xconfirmed');
    await assert.rejects(cancelOrder(f.input.client, f.input.wallet, { ...order, chainId: 1 }, account), /does not match/);
  }
});
