import BN from "bignumber.js";

// Keep both quote directions precise; round only their display labels.
const RateNumber = BN.clone({ DECIMAL_PLACES: 512 });
export type ExchangeRates = { forward: BN; reverse: BN };

/** Convert a percentage when exchanging the numerator and denominator of a price. */
export function invertPricePercentage(value?: string | null) {
  if (value == null || value === "") return value;
  const percent = new RateNumber(value);
  if (!percent.isFinite()) return value;
  // A drop of 100% or more has no positive reciprocal. Keep it invalid in the SDK.
  if (percent.lte(-100)) return "-100";
  return percent.times(-100).div(percent.plus(100)).toFixed();
}

export function getExchangeRates({ inAmount, outAmount, inputDecimals, outputDecimals }: {
  inAmount?: string;
  outAmount?: string;
  inputDecimals?: number;
  outputDecimals?: number;
}): ExchangeRates | undefined {
  if (inputDecimals === undefined || outputDecimals === undefined ||
      !Number.isInteger(inputDecimals) || !Number.isInteger(outputDecimals) ||
      inputDecimals < 0 || outputDecimals < 0 || inputDecimals > 255 || outputDecimals > 255) return undefined;
  const input = new RateNumber(inAmount ?? "");
  const output = new RateNumber(outAmount ?? "");
  if (!input.isFinite() || !output.isFinite() || !input.isInteger() || !output.isInteger() ||
      !input.gt(0) || !output.gt(0)) return undefined;
  return {
    forward: output.shiftedBy(inputDecimals - outputDecimals).div(input),
    reverse: input.shiftedBy(outputDecimals - inputDecimals).div(output),
  };
}

/** Convert an unrounded output-per-input price without passing through Number. */
export function getExchangeRatesFromPrice(price?: string): ExchangeRates | undefined {
  const forward = new RateNumber(price ?? "");
  if (!forward.isFinite() || !forward.gt(0)) return undefined;
  return { forward, reverse: new RateNumber(1).div(forward) };
}

/** Round display labels only, retaining more decimals for small rates. */
export function formatExchangeRate(value: BN): string {
  if (!value.isFinite() || !value.gt(0)) return "—";
  const significantDigits = value.lt(1) ? 5 : 6;
  const decimals = Math.max(0, significantDigits - 1 - (value.e ?? 0));
  const rounded = value.decimalPlaces(decimals, BN.ROUND_HALF_UP);
  return BN(rounded.toFixed()).toFormat();
}
