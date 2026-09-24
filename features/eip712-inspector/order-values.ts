import BigNumber from "bignumber.js";
import { formatUnits } from "viem";
import { record, type Payload, type TokenInfo } from "./inspect";

const Amount = BigNumber.clone({ DECIMAL_PLACES: 360 });

function formatValue(value: BigNumber): string {
  // Keep small amounts visible while shortening ordinary decimal values.
  const rounded = value.abs().lt("0.0001")
    ? value.precision(4, BigNumber.ROUND_HALF_UP)
    : value.decimalPlaces(6, BigNumber.ROUND_HALF_UP);
  return `${value.eq(rounded) ? "" : "≈ "}${rounded.toFormat()}`;
}

export function orderValues(payload: Payload, tokens: TokenInfo[]) {
  const message = payload.message;
  const witness = record(message.witness);
  const input = record(witness.input);
  const output = record(witness.output);
  const inputToken = tokens.find(
    (token) =>
      token.address.toLowerCase() === String(input.token).toLowerCase(),
  );
  const outputToken = tokens.find(
    (token) =>
      token.address.toLowerCase() === String(output.token).toLowerCase(),
  );
  const amount = (raw: unknown, token?: TokenInfo) => {
    const value = String(raw);
    return token
      ? `${formatValue(new Amount(formatUnits(BigInt(value), token.decimals)))} ${token.symbol}`
      : "—";
  };
  const price = (raw: unknown) => {
    if (!inputToken || !outputToken || new Amount(String(input.amount)).lte(0))
      return undefined;
    const rate = new Amount(String(raw))
      .shiftedBy(-outputToken.decimals)
      .div(new Amount(String(input.amount)).shiftedBy(-inputToken.decimals));
    return `${formatValue(rate)} ${outputToken.symbol} per ${inputToken.symbol}`;
  };
  const total = new Amount(String(input.maxAmount));
  const perTrade = new Amount(String(input.amount));
  const tradeCount = perTrade.gt(0)
    ? total
        .dividedToIntegerBy(perTrade)
        .plus(total.mod(perTrade).isZero() ? 0 : 1)
    : new Amount(0);
  const split = tradeCount.gt(1);
  const lowerTrigger = new Amount(String(output.triggerLower)).gt(0);
  const upperTrigger = new Amount(String(output.triggerUpper)).gt(0);
  const hasLimit = new Amount(String(output.limit)).gt(0);
  return {
    witness,
    input,
    output,
    inputToken,
    outputToken,
    amount,
    price,
    split,
    hasLimit,
    tradeCount: tradeCount.toFormat(),
    totalInput: amount(input.maxAmount, inputToken),
    inputPerTrade: amount(input.amount, inputToken),
    minimumOutput: hasLimit
      ? perTrade.gt(0)
        ? amount(
            new Amount(String(output.limit))
              .times(total)
              .dividedToIntegerBy(perTrade)
              .toFixed(0),
            outputToken,
          )
        : "—"
      : "Market price",
    minimumOutputPerTrade: hasLimit
      ? amount(output.limit, outputToken)
      : "Market price",
    smallerFinalTrade: split && !total.mod(perTrade).isZero(),
    lowerTrigger,
    upperTrigger,
    kind:
      lowerTrigger && upperTrigger
        ? "Conditional order"
        : lowerTrigger
          ? "Stop-loss order"
          : upperTrigger
            ? "Take-profit order"
            : split
              ? Number(witness.epoch) > 0
                ? "TWAP order"
                : "Split order"
              : hasLimit
                ? "Limit order"
                : "Market order",
  };
}

export function duration(seconds: unknown): string {
  const value = Number(seconds);
  if (!Number.isFinite(value) || value < 0) return "Not available";
  if (value === 0) return "No minimum delay";
  const units = [
    [86400, "day"],
    [3600, "hour"],
    [60, "minute"],
    [1, "second"],
  ] as const;
  let remaining = value;
  const parts: string[] = [];
  for (const [size, label] of units) {
    const count = Math.floor(remaining / size);
    if (count) {
      parts.push(`${count} ${label}${count === 1 ? "" : "s"}`);
      remaining %= size;
    }
  }
  return parts.join(", ");
}
