import { filterCurrencies } from "@/lib/utils";
import { useMemo } from "react";
import { ChevronRight } from "lucide-react";
import { useCurrencies } from "@/lib/hooks/use-currencies";
import { CurrencyLogo } from "./ui/currency-logo";

function TokensPair({
  srcTokenAddress = "",
  dstTokenAddress = "",
  prefix
}: {
  srcTokenAddress?: string;
  dstTokenAddress?: string;
  prefix?: string;
}) {
  const { currencies } = useCurrencies();
  const { srcToken: srcTokenData, dstToken: dstTokenData } = useMemo(() => {
    return {
      srcToken: filterCurrencies(currencies, [srcTokenAddress])[0],
      dstToken: filterCurrencies(currencies, [dstTokenAddress])[0],
    };
  }, [currencies, srcTokenAddress, dstTokenAddress]);
  return (
    <div className="flex items-center gap-2">
      {prefix && <p className="text-sm whitespace-nowrap font-medium">{prefix}</p>}
      <div className="flex items-center gap-1">
        <CurrencyLogo currency={srcTokenData} className="size-4" fallbackClassName="text-[8px]" />
        <p className="text-sm whitespace-nowrap font-medium">
          {srcTokenData?.symbol}
        </p>
      </div>
      <ChevronRight aria-hidden="true" className="size-4" />
      <div className="flex items-center gap-1">
        <CurrencyLogo currency={dstTokenData} className="size-4" fallbackClassName="text-[8px]" />
        <p className="text-sm whitespace-nowrap font-medium">
          {dstTokenData?.symbol}
        </p>
      </div>
    </div>
  );
}

export default TokensPair;
