"use client";

import { TradeDetails } from "@/components/trade-details";
import { DetailRow } from "@/components/ui/detail-row";
import { useSettings } from "@/lib/hooks/use-settings";
import { formatDisplayAmount } from "@/lib/token-display";
import { getExchangeRates } from "@/lib/exchange-rates";
import { TokenExchangeRate } from "@/components/exchange-rate";
import { SpotRoute } from "./spot-route";
import type { BestTradeQuote, Currency } from "@/lib/types";
import { getQuoteValuation } from "@/lib/swap/quote-valuation";
import styles from "./quote-summary.module.css";

export function SwapQuoteSummary({ trade, inputCurrency, outputCurrency }: {
  trade: BestTradeQuote;
  inputCurrency: Currency;
  outputCurrency: Currency;
}) {
  const { slippageMode } = useSettings();
  const quoteUsd = getQuoteValuation(trade, inputCurrency.decimals, outputCurrency.decimals);
  const rates = getExchangeRates({ inAmount: trade.inAmount, outAmount: trade.outAmount,
    inputDecimals: inputCurrency.decimals, outputDecimals: outputCurrency.decimals });
  if (!rates) return null;

  return <TradeDetails data-swap-quote-summary label="Swap quote details" rate={
    <TokenExchangeRate rates={rates} inputCurrency={inputCurrency} outputCurrency={outputCurrency} inputTokenUsdPrice={quoteUsd.inputTokenUsdPrice} outputTokenUsdPrice={quoteUsd.outputTokenUsdPrice} />
  } summary={<span className={styles.cost}>{formatDisplayAmount(trade.slippage)}% slippage</span>}>
    <DetailRow label="Max slippage" tooltip="The quote service returns the minimum received for this tolerance." value={
      <span className="inline-flex items-center gap-2">
        {slippageMode === "auto" && <span className={styles.badge}>Auto</span>}
        {formatDisplayAmount(trade.slippage)}%
      </span>
    } />
    <SpotRoute />
  </TradeDetails>;
}
