/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { test } = require('node:test');
const ts = require('typescript');
const code = ts.transpileModule(readFileSync(resolve(__dirname, '../components/developer-tools/flow-navigation.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const helpers = {};
new Function('exports', code)(helpers);
const { rewindFlow, remainingWrapAmount } = helpers;

for (const submission of ['submit', 'swap']) {
  test(`returning from ${submission} to signing makes signing active and removes later progress`, () => {
    const current = { history: ['flow', 'check', 'approve', 'sign', submission], viewedIndex: 4 };
    const next = rewindFlow(current, 3);
    assert.deepEqual(next, { history: ['flow', 'check', 'approve', 'sign'], viewedIndex: 3 });
    assert.equal(next.history.at(-1), next.history[next.viewedIndex]);
    assert.equal(current.history.at(-1), submission);
    assert.equal(rewindFlow(next, 4), next, 'later steps cannot be selected until executed again');
  });
}

test('returning to the overview resets progress to Start', () => {
  assert.deepEqual(rewindFlow({ history: ['flow', 'check', 'sign', 'submit', 'success'], viewedIndex: 4 }, 0), {
    history: ['flow'], viewedIndex: 0,
  });
});

test('invalid or current-step selection leaves progress unchanged', () => {
  const current = { history: ['flow', 'check'], viewedIndex: 1 };
  for (const index of [-1, 1, 2, 0.5, NaN]) assert.equal(rewindFlow(current, index), current);
});

test('repeating a wrap step retains completed deposits and only wraps any increase', () => {
  assert.equal(remainingWrapAmount(100n, 0n), 100n);
  assert.equal(remainingWrapAmount(100n, 100n), 0n);
  assert.equal(remainingWrapAmount(80n, 100n), 0n);
  assert.equal(remainingWrapAmount(140n, 100n), 40n);
});
