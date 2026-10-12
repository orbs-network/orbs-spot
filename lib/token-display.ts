import BN from "bignumber.js";

export const SMALL_AMOUNT_THRESHOLD = "0.00001";
export const SMALL_USD_THRESHOLD = "0.01";

export function getSmallAmountThreshold(value?: string | number, minimum = SMALL_AMOUNT_THRESHOLD): string | undefined {
  const amount = BN(value ?? "");
  return amount.gt(0) && amount.lt(minimum) ? minimum : undefined;
}

/** Read-only labels; editable and transaction values keep their numeric precision. */
export function formatDisplayAmount(value?: string | number, {
  decimalScale = 4,
  prefix = "",
  suffix = "",
  minimum = prefix === "$" ? SMALL_USD_THRESHOLD : SMALL_AMOUNT_THRESHOLD,
}: { decimalScale?: number; prefix?: string; suffix?: string; minimum?: string } = {}): string {
  const formatted = formatAmount(value, decimalScale);
  if (!formatted) return "";
  const threshold = getSmallAmountThreshold(value, minimum);
  return threshold ? `<${prefix}${threshold}${suffix}` : `${prefix}${BN(formatted).toFormat()}${suffix}`;
}

/** Display only: truncate after four decimals, skipping leading fractional zeros. */
export function formatAmount(value?: string | number, scale = 4, maxDecimals = 255) {
  if (value === undefined || value === "") return "";
  const amount = BN(value);
  if (!amount.isFinite()) return "";
  if (amount.isZero()) return "0";
  const leadingZeros = Math.max(0, -(amount.e ?? 0) - 1);
  const places = Math.min(maxDecimals, Math.max(0, Math.min(scale, 4)) + leadingZeros);
  return amount.decimalPlaces(places, BN.ROUND_DOWN).toFixed();
}

/** Display precision only; never use this to construct an order or signature. */
export function tokenDisplayDecimals(_symbol?: string, decimals = 18) {
  return Math.min(decimals, 4);
}

export function displayTokenAmount(value: string, _symbol?: string, decimals = 18) {
  return formatAmount(value, 4, decimals);
}
