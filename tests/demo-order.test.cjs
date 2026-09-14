/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { test } = require('node:test');
const ts = require('typescript');
const sdk = require('@orbs-network/spot-ui');
const code = ts.transpileModule(readFileSync(resolve(__dirname, '../components/developer-tools/demo-order.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const helpers = {};
new Function('exports', 'require', code)(helpers, require);
const balance = { type: sdk.InputErrors.INSUFFICIENT_BALANCE, value: '0' };
const minimum = { type: sdk.InputErrors.MIN_TRADE_SIZE, value: 5 };
const form = (errors, ready = true) => ({ isReady: ready, canSubmit: false, errors: { all: errors, primary: errors[0], balance, minTradeSize: errors.includes(minimum) ? minimum : undefined } });
test('demo allows an unfunded wallet without changing the real form', () => {
  const live = form([balance]);
  const demo = helpers.getDemoOrderForm(live);
  assert.equal(demo.canSubmit, true);
  assert.equal(demo.errors.balance, undefined);
  assert.equal(live.canSubmit, false);
  assert.deepEqual(live.errors.all, [balance]);
});
test('demo retains non-balance validation even when balance was the primary error', () => {
  const demo = helpers.getDemoOrderForm(form([balance, minimum]));
  assert.equal(demo.canSubmit, false);
  assert.equal(demo.errors.primary, minimum);
  assert.equal(demo.errors.minTradeSize, minimum);
  assert.deepEqual(demo.errors.all, [minimum]);
});
test('demo never makes missing market data ready', () => {
  assert.equal(helpers.getDemoOrderForm(form([], false)).canSubmit, false);
});

// Exercise the actual event handler with wallet/network functions that must not run.
const modalSource = readFileSync(resolve(__dirname, '../components/developer-tools/live-order-flow-modal.tsx'), 'utf8');
const ast = ts.createSourceFile('flow.tsx', modalSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let handler;
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'executeCurrentStep') handler = node.initializer.arguments[0].getText(ast);
  ts.forEachChild(node, visit);
}
visit(ast);
const handlerJs = ts.transpileModule(`const handler = ${handler}`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
for (const native of [false, true]) {
  test(`demo never calls wallet or submission APIs (${native ? 'native' : 'ERC20'})`, async () => {
    const permit = { domain: { chainId: 56 }, order: { permitted: { token: 'input', amount: '100' }, witness: { output: { token: 'output' } } } };
    const steps = native ? ['flow', 'check', 'wrap', 'approve', 'sign', 'submit', 'success'] : ['flow', 'check', 'approve', 'sign', 'submit', 'success'];
    let forbiddenCalls = 0;
    const forbidden = () => { forbiddenCalls++; throw new Error('Demo reached live execution'); };
    for (let i = 0; i < steps.length - 1; i++) {
      let advanced;
      const context = {
        isRunning: false, step: steps[i], isDemo: true, calculatedForm: undefined,
        calculationContext: '56:input:output', permitData: permit, sourceIsNative: native,
        connectedAccount: helpers.DEMO_ACCOUNT, submitDisabled: true,
        setIsRunning() {}, setWrapAmount() {}, setApprovalRequired() {},
        advanceToStep(value) { advanced = value; },
        actionToastId: 'test', toast: { loading() {}, success() {}, error: forbidden },
        spot: { canDemoExecute: true, client: { submitOrder: forbidden }, orderHistoryPanel: { refetchOrders: forbidden } },
        getTokenAllowance: forbidden, wrapNativeToken: forbidden, approveToken: forbidden,
        signTypedData: forbidden, refetchBalances: forbidden,
        isUserRejectedError: () => false, getErrorMessage: String,
      };
      const execute = new Function(...Object.keys(context), `${handlerJs}; return handler;`)(...Object.values(context));
      await execute();
      assert.equal(advanced, steps[i + 1]);
    }
    assert.equal(forbiddenCalls, 0);
  });
}
