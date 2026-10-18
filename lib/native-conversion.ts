import { zeroAddress } from "viem";

export type NativeConversion = "wrap" | "unwrap";

/** Only the native asset and its own chain's wrapper can convert directly. */
export function getNativeConversion(
  inputAddress?: string,
  outputAddress?: string,
  wrappedAddress?: string,
): NativeConversion | undefined {
  if (!inputAddress || !outputAddress || !wrappedAddress) return undefined;
  const input = inputAddress.toLowerCase();
  const output = outputAddress.toLowerCase();
  const wrapped = wrappedAddress.toLowerCase();
  if (wrapped === zeroAddress) return undefined;
  if (input === zeroAddress && output === wrapped) return "wrap";
  if (input === wrapped && output === zeroAddress) return "unwrap";
  return undefined;
}
