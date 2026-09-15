/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

function load(name) {
  if (name.startsWith('@')) return require(name);
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

test('Liquidity Hub signing expands the message only for editing and signs the edited values', async () => {
  const snippet = liquidityHub.LIQUIDITY_HUB_SIGN_CODE_SNIPPET;
  const data = { message: { permitted: { token: '0x1111111111111111111111111111111111111111', amount: '42' }, nonce: '7' } };
  const view = snippet.format(data);
  assert.equal(snippet.inlineEditable, true);
  assert.match(view, /async function signQuote\(quote: Quote, account: Address, refetchQuote:/);
  assert.match(view, /message: quote.eip712.message,/);
  assert.doesNotMatch(view, /"permitted"/);
  data.message.permitted.amount = '99';
  const edit = snippet.formatEdit(data);
  assert.match(edit, /\/\/ message: quote.eip712.message,/);
  const compiled = ts.transpileModule(edit, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  let signed;
  const quote = { eip712: { domain: { name: 'Permit2' }, types: {}, primaryType: 'PermitWitnessTransferFrom', message: {} } };
  await vm.runInNewContext(`${compiled}\nsignQuote(quote, '0x2222222222222222222222222222222222222222')`, {
    quote,
    exports: {},
    window: { ethereum: {} },
    require: (name) => {
      if (name === '@orbs-network/liquidity-hub-sdk') return { isFreshQuote: () => true };
      assert.equal(name, 'viem');
      return {
        custom: (provider) => provider,
        createWalletClient: () => ({ signTypedData: async (args) => { signed = args; return '0x1234'; } }),
      };
    },
  });
  assert.equal(signed.message.permitted.amount, '99');
  assert.equal(signed.domain, quote.eip712.domain);
});

test('signing refetches only stale quotes and returns the signed quote', async () => {
  const code = liquidityHub.LIQUIDITY_HUB_SIGN_CODE_SNIPPET.format({});
  const compiled = ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  for (const [fresh, minimum] of [[true, '9007199254740993'], [false, '9007199254740993'], [false, '9007199254740994'], [false, '9007199254740992']]) {
    const original = { minAmountOut: '9007199254740993', eip712: { message: { nonce: '1' } } };
    const replacement = { minAmountOut: minimum, eip712: { message: { nonce: '2' } } };
    let refetches = 0;
    let signed;
    const pending = vm.runInNewContext(`${compiled}\nsignQuote(quote, '0x1234', refetchQuote)`, {
      quote: original,
      refetchQuote: async () => { refetches += 1; return replacement; },
      exports: {},
      window: { ethereum: {} },
      require: (name) => name === '@orbs-network/liquidity-hub-sdk'
        ? { isFreshQuote: (quote, seconds) => { assert.equal(seconds, 60); return fresh; } }
        : { custom: (provider) => provider, createWalletClient: () => ({ signTypedData: async (args) => { signed = args; return '0x1234'; } }) },
    });
    if (!fresh && BigInt(minimum) < BigInt(original.minAmountOut)) {
      await assert.rejects(pending, /Please approve the new price before signing/);
      assert.equal(signed, undefined);
      assert.equal(refetches, 1);
      continue;
    }
    const result = await pending;
    assert.equal(refetches, fresh ? 0 : 1);
    assert.equal(result.quote, fresh ? original : replacement);
    assert.equal(signed.message, result.quote.eip712.message);
    assert.equal(result.signature, '0x1234');
  }
});

test('the allowance step reads the displayed quote values and compares the required amount', async () => {
  const quote = {
    inToken: '0x1111111111111111111111111111111111111111',
    user: '0x2222222222222222222222222222222222222222',
    inAmount: '12345678901234567890',
  };
  const code = liquidityHub.LIQUIDITY_HUB_ALLOWANCE_CODE_SNIPPET.format({
    quote,
    quoteArgs: { fromToken: 'old-token', account: 'old-account', inAmount: '1' },
  });
  assert.match(code, /account: Address, \/\//);
  assert.doesNotMatch(code, /const PERMIT2_ADDRESS|await approveTokenIfNeeded\(/);
  for (const allowance of [BigInt(quote.inAmount) - 1n, BigInt(quote.inAmount)]) {
    let request;
    let approvals = 0;
    const compiled = ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
    await vm.runInNewContext(`${compiled}\napproveTokenIfNeeded(quote.user, quote.inToken, "0x000000000022D473030F116dDEE9F6B43aC78BA3", BigInt(quote.inAmount))`, {
      quote,
      erc20Abi: [],
      publicClient: { readContract: async (args) => { request = args; return approvals ? BigInt(quote.inAmount) : allowance; } },
      walletClient: { writeContract: async (args) => { approvals += 1; assert.equal(args.functionName, "approve"); assert.equal(args.args[1], BigInt(quote.inAmount)); return "0x1234"; } },
      waitForTransactionConfirmation: async () => ({}),
    });
    assert.equal(request.address, quote.inToken);
    assert.equal(request.functionName, 'allowance');
    assert.deepEqual(Array.from(request.args), [quote.user, '0x000000000022D473030F116dDEE9F6B43aC78BA3']);
    assert.equal(approvals, allowance >= BigInt(quote.inAmount) ? 0 : 1);
  }
});

test('the generated Liquidity Hub flow type-checks against the installed SDK', () => {
  const file = path.resolve(__dirname, '../liquidity-hub.generated.ts');
  const source = examples.formatLiquidityHubSdkFlow({ chainId: 137, partner: 'playground' });
  const options = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    strict: true,
    skipLibCheck: true,
    noEmit: true,
    types: [],
  };
  const host = ts.createCompilerHost(options);
  const getSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (name, languageVersion, ...args) => name === file
    ? ts.createSourceFile(name, source, languageVersion, true)
    : getSourceFile(name, languageVersion, ...args);
  const program = ts.createProgram([file], options, host);
  const diagnostics = ts.getPreEmitDiagnostics(program);
  assert.equal(diagnostics.length, 0, ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCurrentDirectory: () => process.cwd(),
    getCanonicalFileName: (name) => name,
    getNewLine: () => '\n',
  }));
});

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
        : name === 'LIQUIDITY_HUB_SIGN_CODE_SNIPPET'
        ? code.slice(code.indexOf('async function signQuote('))
        : name === 'LIQUIDITY_HUB_SWAP_AND_CONFIRM_CODE_SNIPPET'
        ? code.slice(code.indexOf('const publicClient ='))
        : code.split('\n').slice(1).join('\n');
      const excerpts = name === 'LIQUIDITY_HUB_SWAP_AND_CONFIRM_CODE_SNIPPET'
        ? excerptCode.split('\n\n')
        : [excerptCode];
      for (const excerpt of excerpts) {
        assert.ok(full.includes(normalize(excerpt)), `${name} should match its full-flow section`);
      }
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

test('all Liquidity Hub generators and supporting files are TypeScript without React hooks', () => {
  const noReact = /\buse[A-Z]\w*|from ["'](?:react|wagmi|@tanstack\/react-query)["']/;
  for (const [name, value] of Object.entries(liquidityHub)) {
    if (name.startsWith('formatLiquidityHub') && typeof value === 'function') {
      assert.doesNotMatch(value({}), noReact, name);
    }
    if (name.endsWith('_CODE_SNIPPET')) {
      assert.equal(value.language, 'TypeScript', name);
      assert.doesNotMatch(value.format({}), noReact, name);
      for (const file of value.files ?? []) assert.doesNotMatch(file.format({}), noReact, file.name);
    }
  }
});

test('submission snippet passes the displayed prepared order and full signature unchanged', async () => {
  const prepared = { order: { permitted: { amount: '90071992547409931234' }, nonce: '42' }, signingRequest: { typedData: { message: { nonce: '42' } } } };
  const signature = '0x' + 'ab'.repeat(65);
  const snippet = advanced.CREATE_ORDER_CODE_SNIPPET.format({ order: prepared.order, signature });
  assert.match(snippet, /import type \{ RePermitOrder \} from "@orbs-network\/spot-ui";/);
  assert.match(snippet, /as RePermitOrder,/);
  const body = snippet.replace(/^import type .*;\n/gm, '');
  const compiled = ts.transpileModule(`async function submit() { ${body} }`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  let submitted;
  await vm.runInNewContext(`${compiled}\nsubmit()`, { client: { submitOrder: async (...args) => { submitted = args; } } });
  assert.deepEqual(JSON.parse(JSON.stringify(submitted)), [prepared.order, signature]);
  const demo = advanced.CREATE_ORDER_CODE_SNIPPET.format({ order: prepared.order, signature: load('demo-order').DEMO_SIGNATURE, demo: true });
  assert.match(demo, /Demo only/);
  assert.ok(demo.includes(load('demo-order').DEMO_SIGNATURE));
  assert.match(load('demo-order').DEMO_SIGNATURE, /^0x[0-9a-f]{130}$/);
});

test('swap submission snippet accepts quote and signature props and returns the confirmed transaction', async () => {
  const quote = { inAmount: '90071992547409931234', outAmount: '23', eip712: { message: { nonce: '42' } } };
  const signature = '0x' + 'ab'.repeat(65);
  const snippet = liquidityHub.LIQUIDITY_HUB_SWAP_AND_CONFIRM_CODE_SNIPPET.format({ quote, execution: { signature } });
  assert.match(snippet, /client.swap\(\s*quote,/);
  assert.doesNotMatch(snippet, /"inAmount"|Parameters<typeof client.swap>/);
  const body = snippet.replace(/^import type .*;\n/gm, '');
  const code = ts.transpileModule(body, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  let submitted;
  let confirmed;
  const receipt = { status: 'success' };
  const result = await vm.runInNewContext(`${code}\nswapAndConfirm({ quote, signature })`, { quote, signature, client: { swap: async (...args) => { submitted = args; return '0x123'; } }, waitForTransactionConfirmation: async (hash) => { confirmed = hash; return receipt; } });
  assert.equal(submitted[0], quote);
  assert.deepEqual(JSON.parse(JSON.stringify(submitted)), [quote, signature]);
  assert.equal(confirmed, '0x123');
  assert.equal(result.hash, '0x123');
  assert.equal(result.receipt, receipt);
});


test('the generated order-history snippet type-checks against the installed SDK', () => {
  const file = path.resolve(__dirname, '../order-history.generated.ts');
  const source = advanced.formatFetchOrdersCode({ query: { chainId: 137, partner: 'external' } });
  const options = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    strict: true,
    skipLibCheck: true,
    noEmit: true,
    types: [],
  };
  const host = ts.createCompilerHost(options);
  const getSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (name, languageVersion, ...args) => name === file
    ? ts.createSourceFile(name, source, languageVersion, true)
    : getSourceFile(name, languageVersion, ...args);
  const program = ts.createProgram([file], options, host);
  const diagnostics = ts.getPreEmitDiagnostics(program);
  assert.equal(diagnostics.length, 0, ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCurrentDirectory: () => process.cwd(),
    getCanonicalFileName: (name) => name,
    getNewLine: () => '\n',
  }));
});

test('history snippet retries client initialization, reuses it, and forwards account and cancellation', async () => {
  const account = '0x1111111111111111111111111111111111111111';
  const source = advanced.formatFetchOrdersCode({ query: { chainId: 137, partner: 'external', swapper: account } });
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  let attempts = 0;
  const requests = [];
  const orders = [{ historyKey: 'v2:137:order' }];
  vm.runInNewContext(code, {
    exports,
    require: (name) => {
      assert.equal(name, '@orbs-network/spot-ui');
      return {
        Partners: { External: 'external' },
        createClient: async (partner, chainId) => {
          assert.equal(partner, 'external');
          assert.equal(chainId, 137);
          if (++attempts === 1) throw new Error('Configuration unavailable');
          return { getAccountOrders: async (request) => { requests.push(request); return orders; } };
        },
      };
    },
  });
  await assert.rejects(exports.fetchOrders(), /Configuration unavailable/);
  const signal = new AbortController().signal;
  assert.equal(await exports.fetchOrders(undefined, signal), orders);
  await exports.fetchOrders('0x2222222222222222222222222222222222222222', signal);
  assert.equal(attempts, 2);
  assert.equal(requests[0].account, account);
  assert.equal(requests[1].account, '0x2222222222222222222222222222222222222222');
  assert.equal(requests[0].signal, signal);
  assert.equal(requests[0].legacyOrders, false);
  assert.deepEqual(Object.keys(requests[0]).sort(), ['account', 'legacyOrders', 'signal']);
});
