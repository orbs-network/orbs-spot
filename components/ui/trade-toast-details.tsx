"use client";

import type { ReactNode } from "react";
import { ArrowRight, ExternalLink } from "lucide-react";
import { CurrencyLogo } from "./currency-logo";
import { getExplorerUrl } from "@/lib/utils";
import { formatAmount } from "@/lib/token-display";
import styles from "./trade-toast-details.module.css";

export type ToastAsset = {
  token: { symbol?: string; name?: string; logoUrl?: string };
  amount?: string;
};

export type ToastTransaction = { label: string; hash: string };

function AssetRow({ asset }: { asset: ToastAsset }) {
  return <span className={styles.asset} data-toast-asset>
    <CurrencyLogo symbol={asset.token.symbol} name={asset.token.name} logoUrl={asset.token.logoUrl}
      className="size-[18px] shrink-0" fallbackClassName="text-[8px]" />
    <span className={styles.value} translate="no">
      {asset.amount && <span className="tabular-nums" aria-label={asset.amount} data-raw-amount={asset.amount}>{formatAmount(asset.amount) || asset.amount} </span>}
      <span>{asset.token.symbol ?? "Token"}</span>
    </span>
  </span>;
}

/** Captured trade details remain readable after the user edits or closes a form. */
export function TradeToastDetails({ input, output, message, chainId, transactions = [], children }: {
  input?: ToastAsset;
  output?: ToastAsset;
  message?: ReactNode;
  chainId?: number;
  transactions?: ToastTransaction[];
  children?: ReactNode;
}) {
  const uniqueTransactions = transactions.filter((transaction, index) => transaction.hash &&
    transactions.findIndex(candidate => candidate.hash.toLowerCase() === transaction.hash.toLowerCase()) === index);
  const explorerTransactions = uniqueTransactions.flatMap(transaction => {
    const href = getExplorerUrl(chainId, transaction.hash);
    return href ? [{ ...transaction, href }] : [];
  });
  const summary = <>
    {(input || output) && <span className={styles.pair} data-toast-pair>
      {input && <AssetRow asset={input} />}
      {input && output && <ArrowRight aria-hidden="true" className="size-3 shrink-0 text-muted-foreground" />}
      {output && <AssetRow asset={output} />}
    </span>}
    {message && <span className="text-xs leading-relaxed [overflow-wrap:anywhere]">{message}</span>}
  </>;
  return <div className="mt-1.5 grid min-w-0 gap-2" data-trade-toast-details>
    {summary}
    {explorerTransactions.length > 0 && <div className={styles.transactions}>
      {explorerTransactions.map(({ label, hash, href }) => <a key={hash} href={href} target="_blank" rel="noopener noreferrer"
        aria-label={`View ${label.toLowerCase()} on explorer`} title={label}
        className={styles.explorer} data-toast-transaction>
        {explorerTransactions.length === 1 ? "View on explorer" : `${label.replace(/\s+transaction$/i, "")} explorer`}
        <ExternalLink aria-hidden="true" className="size-3 shrink-0" />
      </a>)}
    </div>}
    {children}
  </div>;
}
