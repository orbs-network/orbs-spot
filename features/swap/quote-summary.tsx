"use client";

import BN from "bignumber.js";
import { useId, useState } from "react";
import { ChevronDownIcon, FuelIcon } from "lucide-react";
import { DetailRow } from "@/components/ui/detail-row";
import { useSettings } from "@/lib/hooks/use-settings";
import { useUSDPrice } from "@/lib/hooks/use-usd-price";
import { formatDisplayAmount } from "@/lib/token-display";
import type { BestTradeQuote, Currency } from "@/lib/types";
import { toAmountUI } from "@/lib/utils";
import styles from "./quote-summary.module.css";

export function SwapQuoteSummary({ trade, inputCurrency, outputCurrency }: {
  trade: BestTradeQuote;
  inputCurrency: Currency;
  outputCurrency: Currency;
}) {
  const [open, setOpen] = useState(false);
  const [instant, setInstant] = useState(false);
  const contentId = useId();
  const { slippageMode } = useSettings();
  // Calculate from the raw quote, never the rounded amount displayed in the input.
  const input = BN(toAmountUI(trade.inAmount, inputCurrency.decimals));
  const output = BN(toAmountUI(trade.outAmount, outputCurrency.decimals));
  const rate = input.gt(0) && output.gt(0) ? output.div(input) : BN(0);
  const rateUsd = useUSDPrice({ token: outputCurrency.address, amount: rate.toFixed() });
  const gas = trade.originalQuote.gasAmountOut;
  const hasCost = gas !== undefined && BN(gas).isInteger() && BN(gas).gte(0);
  const costAmount = hasCost ? toAmountUI(gas, outputCurrency.decimals) : undefined;
  const costUsd = useUSDPrice({ token: outputCurrency.address, amount: costAmount ?? "0" });
  const cost = !hasCost ? "Not provided" : BN(costAmount ?? "").isZero() ? "$0"
    : costUsd.data !== undefined && !costUsd.isError ? costUsd.formatted
    : `${formatDisplayAmount(costAmount)} ${outputCurrency.symbol}`;

  if (!rate.isFinite() || !rate.gt(0)) return null;

  return (
    <div data-swap-quote-summary data-open={open} data-instant={instant} className={styles.root}>
      <button type="button" data-hover="text" className={styles.trigger} aria-label="Swap quote details" aria-expanded={open} aria-controls={contentId} onClick={event => {
        setInstant(event.detail === 0);
        setOpen(value => !value);
      }}>
        <span className={styles.rate}>
          <span>1 {inputCurrency.symbol} = {formatDisplayAmount(rate.toFixed())} {outputCurrency.symbol}</span>
          {rateUsd.data !== undefined && !rateUsd.isError && <span className={styles.usd}>({rateUsd.formatted})</span>}
        </span>
        <span className={styles.cost} aria-hidden={open}>
          <FuelIcon aria-hidden="true" className="size-3.5 shrink-0" />
          <span>{hasCost ? cost : "—"}</span>
        </span>
        <ChevronDownIcon aria-hidden="true" className={styles.chevron} />
      </button>
      <div id={contentId} className={styles.collapse} inert={!open} aria-hidden={!open}>
        <div className={styles.clip}>
          <div className={styles.rows}>
        <DetailRow label="Network cost" value={cost} tooltip="Estimated execution cost quoted in the output token. Any wallet gas for approval or wrapping is additional." />
        <DetailRow label="Max slippage" tooltip="The maximum price change allowed when executing this swap." value={
          <span className="inline-flex items-center gap-2">
            {slippageMode === "auto" && <span className={styles.badge}>Auto</span>}
            {formatDisplayAmount(trade.originalQuote.slippage)}%
          </span>
        } />
        <DetailRow label="Route" value="Orbs Liquidity Hub" tooltip="Swaps are executed through Orbs Liquidity Hub." />
          </div>
        </div>
      </div>
    </div>
  );
}
