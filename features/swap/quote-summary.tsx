"use client";

import BN from "bignumber.js";
import { FuelIcon } from "lucide-react";
import { TradeDetails } from "@/components/trade-details";
import { DetailRow } from "@/components/ui/detail-row";
import { useSettings } from "@/lib/hooks/use-settings";
import { useUSDPrice } from "@/lib/hooks/use-usd-price";
import { formatDisplayAmount } from "@/lib/token-display";
import { getExchangeRates } from "@/lib/exchange-rates";
import { TokenExchangeRate } from "@/components/exchange-rate";
import { LiquidityHubRoute } from "./liquidity-hub-route";
import type { BestTradeQuote, Currency } from "@/lib/types";
import { toAmountUI } from "@/lib/utils";
import styles from "./quote-summary.module.css";

export function SwapQuoteSummary({ trade, inputCurrency, outputCurrency }: {
  trade: BestTradeQuote;
  inputCurrency: Currency;
  outputCurrency: Currency;
}) {
  const { slippageMode } = useSettings();
  // Calculate from the raw quote, never the rounded amount displayed in the input.
  const rates = getExchangeRates({
    inAmount: trade.inAmount, outAmount: trade.outAmount,
    inputDecimals: inputCurrency.decimals, outputDecimals: outputCurrency.decimals,
  });
  const gas = trade.originalQuote.gasAmountOut;
  const hasCost = gas !== undefined && BN(gas).isInteger() && BN(gas).gte(0);
  const costAmount = hasCost ? toAmountUI(gas, outputCurrency.decimals) : undefined;
  const costUsd = useUSDPrice({ token: outputCurrency.address, amount: costAmount ?? "0" });
  const cost = !hasCost ? "Not provided" : BN(costAmount ?? "").isZero() ? "$0"
    : costUsd.data !== undefined && !costUsd.isError ? costUsd.formatted
    : `${formatDisplayAmount(costAmount)} ${outputCurrency.symbol}`;

  if (!rates) return null;

  return (
    <TradeDetails data-swap-quote-summary label="Swap quote details" rate={
      <TokenExchangeRate rates={rates} inputCurrency={inputCurrency} outputCurrency={outputCurrency} />
    } summary={
      <span className={styles.cost}>
        <FuelIcon aria-hidden="true" className="size-3.5 shrink-0" />
        <span>{hasCost ? cost : "—"}</span>
      </span>
    }>
      <DetailRow label="Network cost" value={cost} tooltip="Estimated execution cost quoted in the output token. Any wallet gas for approval or wrapping is additional." />
      <DetailRow label="Max slippage" tooltip="The maximum price change allowed when executing this swap." value={
        <span className="inline-flex items-center gap-2">
          {slippageMode === "auto" && <span className={styles.badge}>Auto</span>}
          {formatDisplayAmount(trade.originalQuote.slippage)}%
        </span>
      } />
      <LiquidityHubRoute />
    </TradeDetails>
  );
}
