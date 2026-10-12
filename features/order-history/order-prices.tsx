import type { DerivedHistoryOrder } from "./format";
import { formatPriceValue, isZeroValue } from "./format";

export function OrderPrices({ details }: { details?: DerivedHistoryOrder }) {
  const price = (value: string) => formatPriceValue(value, details?.inputToken?.symbol, details?.outputToken?.symbol);
  if (!details?.inputToken || !details.outputToken) return <span>—</span>;
  return (
    <div className="flex flex-col gap-1 text-xs">
      <span>{details.original.isMarketPrice ? "Market" : `Limit: ${price(details.limitPrice.ui)}`}</span>
      {!isZeroValue(details.triggerPrice.ui) && <span>Trigger: {price(details.triggerPrice.ui)}</span>}
    </div>
  );
}
