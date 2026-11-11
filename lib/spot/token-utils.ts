import BN from "bignumber.js";

/** Native placeholders used by the host form and quote services. */
export function isNativeAddress(address?: string): boolean {
  const value = address?.toLowerCase();
  return value === "0x0000000000000000000000000000000000000000" ||
    value === "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
}

/** Convert token base units for display without losing decimal precision. */
export function toAmountUI(value?: string, decimals?: number): string {
  if (!value || decimals === undefined || !Number.isInteger(decimals) || decimals < 0 || decimals > 255) return "";
  const amount = BN(value);
  return amount.isFinite() ? amount.shiftedBy(-decimals).toFixed() : "";
}

/** Convert a display amount to integer token units, rounding down. */
export function toAmountRaw(value?: string, decimals?: number): string {
  if (!value || decimals === undefined || !Number.isInteger(decimals) || decimals < 0 || decimals > 255) return "";
  const amount = BN(value);
  return amount.isFinite() ? amount.shiftedBy(decimals).integerValue(BN.ROUND_DOWN).toFixed() : "";
}
