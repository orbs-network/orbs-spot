import assert from "node:assert/strict";
import test from "node:test";
import { zeroAddress } from "viem";
import { getNativeConversion } from "../lib/native-conversion.ts";

const weth = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const wbnb = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";
const usdc = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";

test("native and its own wrapper convert directly in either direction", () => {
  for (const wrapped of [weth, wbnb]) {
    assert.equal(getNativeConversion(zeroAddress, wrapped, wrapped), "wrap");
    assert.equal(getNativeConversion(wrapped, zeroAddress, wrapped), "unwrap");
    assert.equal(getNativeConversion(zeroAddress, wrapped.toUpperCase(), wrapped.toLowerCase()), "wrap");
    assert.equal(getNativeConversion(wrapped.toLowerCase(), zeroAddress, wrapped.toUpperCase()), "unwrap");
  }
});

test("ordinary swaps and wrappers from another chain never use conversion", () => {
  for (const [input, output] of [
    [zeroAddress, usdc], [usdc, zeroAddress], [weth, usdc], [usdc, weth],
    [zeroAddress, wbnb], [wbnb, zeroAddress], [weth, weth], [zeroAddress, zeroAddress],
  ]) assert.equal(getNativeConversion(input, output, weth), undefined);
});

test("missing tokens or an unavailable wrapper do not enable conversion", () => {
  for (const [input, output, wrapped] of [
    [undefined, weth, weth], [zeroAddress, undefined, weth], [zeroAddress, weth, undefined],
    ["", weth, weth], [zeroAddress, weth, ""], [zeroAddress, zeroAddress, zeroAddress],
  ]) assert.equal(getNativeConversion(input, output, wrapped), undefined);
});
