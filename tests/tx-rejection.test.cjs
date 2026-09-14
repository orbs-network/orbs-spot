/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const ts = require('typescript');
const vm = require('node:vm');

const code = ts.transpileModule(readFileSync('lib/tx-rejection.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const dismissed = [];
const api = {};
vm.runInNewContext(code, {
  exports: api,
  require: () => ({ toast: { dismiss: (id) => dismissed.push(id) } }),
});

test('wallet rejection is recognized while actual transaction failures remain errors', () => {
  assert.equal(api.isUserRejectedError({ code: 4001 }), true);
  assert.equal(api.isUserRejectedError({ cause: { code: 'ACTION_REJECTED' } }), true);
  assert.equal(api.isUserRejectedError({ message: 'execution reverted' }), false);
});

test('wallet rejection silently clears pending and previous rejection notices', () => {
  api.dismissTransactionRejectedToast({ id: 'order-submit' });
  assert.deepEqual(dismissed, ['order-submit', 'order-submit-rejected']);
});
