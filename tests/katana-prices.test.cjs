/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

const eth = '0xee7d8bcfb72bc1880d0cf19822eb0a2e6577ab62';
const usdc = '0x203a662b0bd271a6ed5a60edfbd04bfce608fd36';
const source = readFileSync(resolve(__dirname, '../lib/get-usd-price.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;

for (const useFallback of [false, true]) {
  test(`Katana advanced-order prices resolve through ${useFallback ? 'DexScreener fallback' : 'Llama'}`, async () => {
    const exports = {};
    const requests = [];
    vm.runInNewContext(compiled, {
      exports,
      console,
      require: (name) => name === './utils' ? {
        isNativeAddress: () => false,
        getWrappedNativeCurrency: () => ({ address: eth }),
      } : require(name),
      fetch: async (url) => {
        requests.push(url);
        if (url.startsWith('https://coins.llama.fi/')) {
          assert.ok(url.includes(`katana:${eth},katana:${usdc}`));
          return { ok: true, json: async () => ({ coins: useFallback ? {} : {
            [`katana:${eth}`]: { price: 2500 },
            [`katana:${usdc}`]: { price: 1 },
          } }) };
        }
        assert.equal(url, `https://api.dexscreener.com/tokens/v1/katana/${eth},${usdc}`);
        return { ok: true, json: async () => [{
          baseToken: { address: eth }, quoteToken: { address: usdc },
          priceUsd: '2500', priceNative: '2500', liquidity: { usd: 1000000 },
        }] };
      },
    });
    const prices = await exports.getUSDPrice([eth, usdc], 747474);
    assert.equal(prices[eth], 2500);
    assert.equal(prices[usdc], 1);
    assert.equal(requests.length, useFallback ? 2 : 1);
  });
}
