/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

function load(name) {
  const file = path.resolve(__dirname, '../components/developer-tools', name + '.ts');
  const source = fs.readFileSync(file, 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require: (dependency) => load(dependency) });
  return exports;
}

const advanced = load('code-examples');
const liquidityHub = load('liquidity-hub-code-examples');
const examples = load('sdk-flow-examples');
const normalize = (code) => code.split('\n').map((line) => line.trim()).filter(Boolean).join('\n');

for (const [label, module, fullFlow, names] of [
  ['Advanced Orders', advanced, examples.ADVANCED_ORDERS_SDK_FLOW, [
    'LIVE_CHECK_APPROVAL_CODE_SNIPPET', 'LIVE_WRAP_NATIVE_TOKEN_CODE_SNIPPET',
    'LIVE_APPROVE_TOKEN_CODE_SNIPPET', 'SIGNATURE_EXAMPLE_CODE_SNIPPET', 'CREATE_ORDER_CODE_SNIPPET',
  ]],
  ['Liquidity Hub', liquidityHub, examples.LIQUIDITY_HUB_SDK_FLOW, [
    'LIQUIDITY_HUB_ALLOWANCE_CODE_SNIPPET', 'LIQUIDITY_HUB_WRAP_CODE_SNIPPET',
    'LIQUIDITY_HUB_APPROVAL_CODE_SNIPPET', 'LIQUIDITY_HUB_SIGN_CODE_SNIPPET',
    'LIQUIDITY_HUB_SWAP_AND_CONFIRM_CODE_SNIPPET',
  ]],
]) {
  test(`${label} steps reuse the full TypeScript flow without React dependencies`, () => {
    const full = normalize(fullFlow.format({}));
    for (const name of names) {
      const snippet = module[name];
      const code = snippet.format({});
      assert.doesNotMatch(code, /\buse[A-Z]\w*|from ["'](?:react|wagmi|@orbs-network\/spot-react)["']/);
      const excerptCode = name === 'SIGNATURE_EXAMPLE_CODE_SNIPPET'
        ? code.slice(code.indexOf('const prepared = client.prepareOrder('), code.indexOf('  return { prepared, signature };'))
        : code.split('\n').slice(1).join('\n');
      const excerpt = normalize(excerptCode);
      assert.ok(full.includes(excerpt), `${name} should match its full-flow section`);
      for (const file of snippet.files ?? []) {
        assert.doesNotMatch(file.format({}), /\buse[A-Z]\w*|from ["'](?:react|wagmi)["']/);
      }
    }
  });
}

test('signing embeds the editable live message instead of a separate data tab', () => {
  const snippet = advanced.SIGNATURE_EXAMPLE_CODE_SNIPPET;
  const data = advanced.SIGNATURE_EXAMPLE_DATA;
  const code = snippet.formatEdit(data);
  assert.equal(snippet.inlineEditable, true);
  assert.equal(snippet.files, undefined);
  assert.match(code, /\/\/ message: message.message,/);
  assert.ok(code.includes(`"nonce": "${data.message.nonce}"`));
  const edited = structuredClone(data);
  edited.message.permitted.amount = '42';
  assert.match(snippet.formatEdit(edited), /"amount": "42"/);
});

test('the signing step wraps preparation and signing in a plain async function', () => {
  const code = advanced.SIGNATURE_EXAMPLE_CODE_SNIPPET.format({});
  assert.match(code, /export async function signOrder\(account: Address, input: OrderInput, form: CalculatedOrderForm\)/);
  assert.match(code, /return \{ prepared, signature \};/);
});

test('every string and number in the signing message has a tooltip, but configuration keys do not', () => {
  const explain = advanced.SIGNATURE_EXAMPLE_CODE_SNIPPET.getFieldExplanation;
  let count = 0;
  function visit(value, path) {
    if (typeof value === 'string' || typeof value === 'number') {
      assert.ok(explain(path, value), `Missing tooltip for ${path.join('.')}`);
      count += 1;
    } else if (value && typeof value === 'object') {
      assert.equal(explain(path, value), undefined);
      for (const [key, child] of Object.entries(value)) visit(child, [...path, key]);
    }
  }
  visit(advanced.SIGNATURE_EXAMPLE_DATA.message, ['message']);
  assert.ok(count > 20);
  for (const key of ['domain', 'types', 'primaryType', 'account']) {
    assert.equal(explain([key], 'example'), undefined);
  }
});

test('the message expands only in edit mode', () => {
  const snippet = advanced.SIGNATURE_EXAMPLE_CODE_SNIPPET;
  const data = advanced.SIGNATURE_EXAMPLE_DATA;
  const view = snippet.format(data);
  const edit = snippet.formatEdit(data);
  assert.match(view, /message: message.message,/);
  assert.doesNotMatch(view, /"permitted":/);
  assert.match(edit, /"permitted":/);
  assert.match(edit, /\/\/ message: message.message,/);
});
