/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { test } = require('node:test');
const ts = require('typescript');
const BN = require('bignumber.js');
const source = readFileSync(resolve(__dirname, '../components/developer-tools/liquidity-hub-developer-content.tsx'), 'utf8');
const ast = ts.createSourceFile('flow.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let handler;
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(ast).includes('mutate: executeCurrentStep')) handler = node.initializer.arguments[0].properties.find((property) => property.name?.getText(ast) === 'mutationFn').initializer.getText(ast);
  ts.forEachChild(node, visit);
}
visit(ast);
const compiled = ts.transpileModule(`const handler = ${handler}`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
for (const native of [false, true]) {
  test(`demo swap never uses wallet, swap, or receipt APIs (${native ? 'native' : 'ERC20'})`, async () => {
    const quote = { inAmount: '100', outAmount: '200' };
    const steps = native ? ['flow', 'check', 'wrap', 'approve', 'sign', 'swap', 'success'] : ['flow', 'check', 'approve', 'sign', 'swap', 'success'];
    let forbiddenCalls = 0;
    const forbidden = () => { forbiddenCalls++; throw new Error('Demo reached a real API'); };
    for (let i = 0; i < steps.length - 1; i++) {
      let advanced;
      let signature;
      const context = {
        executionInFlight: { current: false }, step: steps[i], isDemo: true, executionQuote: quote, liveQuote: quote,
        sourceIsNative: native, BN, DEMO_SIGNATURE: '0x' + '11'.repeat(65),
        setApprovalRequired() {}, setExecutionQuote() {},
        setSignature(value) { signature = value; }, advanceToStep(value) { advanced = value; },
        actionToastId: 'test', toast: { loading() {}, success() {}, error: forbidden },
        liquidityHub: { getQuote: forbidden, swap: forbidden },
        ensureAllowance: forbidden, approve: forbidden, wrap: forbidden,
        signQuote: forbidden, getTransactionReceipt: forbidden, refetchBalances: forbidden,
        isUserRejectedError: () => false, getErrorMessage: String,
      };
      await new Function(...Object.keys(context), `${compiled}; return handler;`)(...Object.values(context))();
      assert.equal(advanced, steps[i + 1]);
      if (steps[i] === 'sign') assert.match(signature, /^0x[0-9a-f]{130}$/);
    }
    assert.equal(forbiddenCalls, 0);
  });
}
