import BN from "bignumber.js";

const PRESET_DECIMALS = 7;

/** Round automatic input amounts down before storing them, not just for display. */
export function toPresetAmount(value: string, tokenDecimals = 18): string {
  const amount = BN(value);
  if (!amount.isFinite() || amount.isNegative()) return "";
  return amount.decimalPlaces(Math.min(PRESET_DECIMALS, tokenDecimals), BN.ROUND_DOWN).toFixed();
}
