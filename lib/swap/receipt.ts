import BN from "bignumber.js";
import { formatAmount } from "../token-display";

const ReceiptNumber = BN.clone({ DECIMAL_PLACES: 512 });

export interface SwapReceipt {
  quotedAmount: string;
  receivedAmount?: string;
  receivedAmountUsd?: string;
  comparison?: {
    direction: "more" | "less";
    quotedAmount: string;
    differenceAmount: string;
    differencePercent: string;
  };
}

interface SwapReceiptInput {
  quotedOutputAmount: string;
  quotedOutputAmountUsd?: string;
  receivedAmountRaw?: string;
  outputDecimals: number;
}

/** Keep the quote as the baseline; only a valid fill supplies the received amount. */
export function getSwapReceipt({
  quotedOutputAmount,
  quotedOutputAmountUsd,
  receivedAmountRaw,
  outputDecimals,
}: SwapReceiptInput): SwapReceipt {
  const receipt: SwapReceipt = { quotedAmount: quotedOutputAmount };
  if (!Number.isInteger(outputDecimals) || outputDecimals < 0 || outputDecimals > 255 ||
      receivedAmountRaw === undefined || !/^\d+$/.test(receivedAmountRaw)) return receipt;

  const receivedRaw = new ReceiptNumber(receivedAmountRaw);
  const received = receivedRaw.shiftedBy(-outputDecimals);
  receipt.receivedAmount = received.toFixed();

  const quoted = new ReceiptNumber(quotedOutputAmount);
  const quotedRaw = quoted.shiftedBy(outputDecimals);
  if (!quoted.isFinite() || !quoted.gt(0) || !quotedRaw.isInteger()) return receipt;

  const quotedUsd = new ReceiptNumber(quotedOutputAmountUsd ?? "");
  if (quotedUsd.isFinite() && quotedUsd.gte(0)) {
    // Quote metadata is a valuation estimate, scaled to the actual filled output.
    receipt.receivedAmountUsd = quotedUsd.times(receivedRaw).div(quotedRaw).toFixed();
  }

  const difference = received.minus(quoted);
  if (difference.isZero() ||
      formatAmount(received.toFixed(), 4, outputDecimals) === formatAmount(quoted.toFixed(), 4, outputDecimals) ||
      !new ReceiptNumber(formatAmount(difference.abs().toFixed(), 4, outputDecimals)).gt(0)) return receipt;

  receipt.comparison = {
    direction: difference.gt(0) ? "more" : "less",
    quotedAmount: quotedOutputAmount,
    differenceAmount: difference.abs().toFixed(),
    differencePercent: difference.abs().div(quoted).times(100).toFixed(),
  };
  return receipt;
}
