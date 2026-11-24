import assert from "node:assert/strict";
import { test } from "node:test";
import { createBrandPalette } from "../lib/partners/palette.ts";
import { getRpcGateway, getRpcUrls } from "../lib/rpc-config.ts";
import { getSpotApiUrl, isSpotDebugMode, DEFAULT_SPOT_API_URL } from "../lib/spot/api.ts";
import { rpcRateLimitResponse } from "../lib/server/rpc-limit.ts";

function luminance(hex) {
  const rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}

test("generated palettes keep primary button text readable", () => {
  for (const color of ["#000000", "#ffffff", "#2563eb", "#ffcc00", "#9146ff"]) {
    for (const mode of Object.values(createBrandPalette(color))) {
      const a = luminance(color), b = luminance(mode.colors.primaryForeground);
      assert.ok((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) >= 4.5);
    }
  }
  assert.throws(() => createBrandPalette("red"), /six-digit/);
});

test("RPC mapping validates chain IDs and rejects unsafe URLs", () => {
  const previous = process.env.RPC_URLS;
  try {
    delete process.env.RPC_URLS;
    assert.equal(getRpcUrls(), undefined);
    process.env.RPC_URLS = '{"1":"https://example.com/rpc"}';
    assert.deepEqual(getRpcUrls(), { "1": "https://example.com/rpc" });
    for (const invalid of ["[]", "{}", '{"0":"https://example.com"}', '{"1":"file:///private"}', "not-json"]) {
      process.env.RPC_URLS = invalid;
      assert.throws(() => getRpcUrls(), /RPC_URLS/);
    }
  } finally {
    if (previous === undefined) delete process.env.RPC_URLS;
    else process.env.RPC_URLS = previous;
  }
});

test("per-instance RPC ceiling returns a retryable response", () => {
  const previous = process.env.RPC_RATE_LIMIT_PER_MINUTE;
  try {
    process.env.RPC_RATE_LIMIT_PER_MINUTE = "2";
    assert.equal(rpcRateLimitResponse(), undefined);
    assert.equal(rpcRateLimitResponse(), undefined);
    const response = rpcRateLimitResponse();
    assert.equal(response?.status, 429);
    assert.ok(Number(response?.headers.get("Retry-After")) > 0);
  } finally {
    if (previous === undefined) delete process.env.RPC_RATE_LIMIT_PER_MINUTE;
    else process.env.RPC_RATE_LIMIT_PER_MINUTE = previous;
  }
});


test("deployed query selection retains debug and API overrides", () => {
  assert.equal(getSpotApiUrl(new URLSearchParams("api=dev")), "https://order-sink-dev.orbs.network");
  assert.equal(getSpotApiUrl(new URLSearchParams("api=v1")), "https://order-sink.orbs.network");
  assert.equal(getSpotApiUrl(new URLSearchParams("api=unknown")), DEFAULT_SPOT_API_URL);
  assert.equal(isSpotDebugMode(new URLSearchParams("debug=true")), true);
  assert.equal(isSpotDebugMode(new URLSearchParams("api=dev")), true);
  assert.equal(isSpotDebugMode(new URLSearchParams("api=unknown")), false);
});

test("RPC gateway validation does not expose its value in errors", () => {
  const previous = process.env.RPC_URL;
  try {
    process.env.RPC_URL = "file:///private";
    assert.throws(() => getRpcGateway(), { message: "RPC_URL must be a valid HTTP(S) URL" });
    process.env.RPC_URL = "https://example.com/rpc";
    assert.equal(getRpcGateway(), "https://example.com/rpc");
  } finally {
    if (previous === undefined) delete process.env.RPC_URL;
    else process.env.RPC_URL = previous;
  }
});
