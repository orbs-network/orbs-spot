/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const { resolve, dirname } = require('node:path');
const ts = require('typescript');
const { isAddress, zeroAddress } = require('viem');

function loadTs(file, mocks = {}, cache = new Map()) {
  const path = resolve(__dirname, '..', file);
  if (cache.has(path)) return cache.get(path);
  const exports = {};
  cache.set(path, exports);
  const code = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  new Function('exports', 'require', code)(exports, (name) => {
    if (name in mocks) return mocks[name];
    return name.startsWith('.') ? loadTs(resolve(dirname(path), `${name}.ts`), mocks, cache) : require(name);
  });
  return exports;
}

const config = loadTs('lib/consts.ts');
const { wCurrencies } = loadTs('lib/wrapped-currencies.ts');
const ids = chains => chains.map(chain => chain.id).sort((a,b) => a-b);

// Configured Orbs product coverage, with Fantom and Polygon zkEVM removed.
const swapIds = [1,56,137,146,8453,42161,59144,81457];
const orderIds = [1,10,14,30,56,130,137,143,146,196,999,1329,4326,4663,5000,8453,9745,42161,43114,57073,59144,80094,747474];
test('menus match configured product coverage and every chain is wallet-configured', () => {
  assert.deepEqual(ids(config.MAIN_CHAINS), swapIds);
  assert.deepEqual(ids(config.SPOT_CHAINS), orderIds);
  const all = [...new Set([...swapIds, ...orderIds])].sort((a,b) => a-b);
  assert.deepEqual(ids(config.SUPPORTED_CHAINS), all);
});

test('every selectable chain has native wrapping, default tokens, and explorer metadata', () => {
  for (const chain of config.SUPPORTED_CHAINS) {
    const pair = config.DEFAULT_TOKENS[chain.id];
    assert.ok(pair, `${chain.name}: missing default pair`);
    assert.ok(isAddress(pair.input) && isAddress(pair.output), chain.name);
    assert.notEqual(pair.input.toLowerCase(), pair.output.toLowerCase());
    assert.ok(isAddress(wCurrencies[chain.id]?.address), `${chain.name}: missing wrapped native`);
    assert.equal(wCurrencies[chain.id].decimals, chain.nativeCurrency.decimals);
    assert.ok(chain.blockExplorers?.default.url.startsWith('https://'), chain.name);
    assert.ok(isAddress(chain.contracts?.multicall3?.address), `${chain.name}: missing balance multicall`);
    assert.ok(config.CHAIN_LOGO_URLS[chain.id], chain.name);
  }
});

test('new-chain defaults remain selectable when the token list omits the canonical wrapper', async () => {
  const { ADDITIONAL_CHAIN_TOKENS } = loadTs('lib/additional-chain-tokens.ts');
  const { getCurrencies } = loadTs('lib/get-currencies.ts', {
    axios: { get: async () => ({ data: { tokens: [] } }) },
  });
  for (const id of Object.keys(ADDITIONAL_CHAIN_TOKENS).map(Number)) {
    const currencies = await getCurrencies(id);
    assert.equal(currencies[0].address, zeroAddress);
    for (const address of Object.values(config.DEFAULT_TOKENS[id])) {
      assert.ok(currencies.some(token => token.address.toLowerCase() === address.toLowerCase()), `${id}: ${address}`);
    }
  }
});

test('every configured chain can request USD prices, including native assets', async (t) => {
  const originalFetch = global.fetch;
  t.after(() => { global.fetch = originalFetch; });
  const { getUSDPrice } = loadTs('lib/get-usd-price.ts');
  for (const chain of config.SUPPORTED_CHAINS) {
    let requested = false;
    global.fetch = async (url) => {
      requested = true;
      assert.match(url, /^https:\/\/coins\.llama\.fi\/prices\/current\//);
      const coin = url.split('/current/')[1];
      assert.ok(coin.endsWith(wCurrencies[chain.id].address.toLowerCase()));
      return { ok: true, json: async () => ({coins: {[coin]: {price: 2}}}) };
    };
    const prices = await getUSDPrice([zeroAddress], chain.id);
    assert.equal(requested, true, chain.name);
    assert.equal(prices[zeroAddress], 2, chain.name);
  }
});

test('configured chains use the partner RPC proxy', (t) => {
  const oldRpc = process.env.RPC_URL;
  t.after(() => {
    if (oldRpc === undefined) delete process.env.RPC_URL; else process.env.RPC_URL = oldRpc;
  });
  process.env.RPC_URL = 'https://rpc.example.test';
  const { getRpcUrl } = loadTs('lib/rpc-url.ts', {
    './partners/server': { getActivePartnerConfig: () => ({id:'orbs'}) },
  });
  const proxy = new URL(getRpcUrl(4663));
  assert.equal(proxy.hostname, 'rpc.example.test');
  assert.equal(proxy.searchParams.get('chainId'), '4663');
  assert.equal(proxy.searchParams.get('appId'), 'orbs');
});

test('removed networks cannot access chain-scoped API endpoints', () => {
  const { parseSupportedChainId } = loadTs('lib/server/request.ts', { '@/lib/consts': config });
  for (const id of [250, 1101]) {
    assert.throws(() => parseSupportedChainId(id), /Unsupported chain/);
    assert.equal(config.DEFAULT_TOKENS[id], undefined);
    assert.equal(wCurrencies[id], undefined);
  }
});
