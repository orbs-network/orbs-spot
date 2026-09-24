/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const { test } = require('node:test');

for (const build of ['CommonJS', 'ES module']) {
  test(`${build} history always filters both endpoints by configured exchange`, async (t) => {
    const sdk = build === 'CommonJS'
      ? require('@orbs-network/spot-ui')
      : await import('@orbs-network/spot-ui');
    const originalFetch = global.fetch;
    t.after(() => { global.fetch = originalFetch; });
    const account = '0x50015A452E644F5511fbeeac6B2aD2bf154E40E4';
    const signal = new AbortController().signal;
    for (const [partner, chainId, exchangeAddress] of [
      [sdk.Partners.Ginco, 42161, '0x1111111111111111111111111111111111111111'],
      [sdk.Partners.External, 137, '0x2222222222222222222222222222222222222222'],
    ]) {
      const requests = [];
      global.fetch = async (input, options) => {
        const url = new URL(input);
        if (url.pathname === '/config') {
          assert.equal(url.searchParams.get('partner'), partner);
          assert.equal(url.searchParams.get('chain'), String(chainId));
          return { ok: true, json: async () => ({
            domain: { chainId, verifyingContract: account },
            order: { witness: { chainid: chainId, exchange: { adapter: exchangeAddress } } },
          }) };
        }
        assert.equal(url.pathname, '/orders');
        assert.deepEqual(Object.fromEntries(url.searchParams), {
          swapper: account, chainId: String(chainId), exchange: partner,
        });
        assert.equal(options.signal, signal);
        requests.push(url.hostname);
        // A failed primary endpoint must still allow the fallback to return history.
        return url.hostname === 'order-sink-v2.orbs.network'
          ? { ok: false, status: 503 }
          : { ok: true, json: async () => ({ orders: [] }) };
      };
      const client = await sdk.createClient(partner, chainId);
      assert.deepEqual(await client.getAccountOrders({ account, signal, legacyOrders: false }), []);
      assert.deepEqual(requests.sort(), ['order-sink-v2.orbs.network', 'order-sink.orbs.network']);
    }
  });
}
