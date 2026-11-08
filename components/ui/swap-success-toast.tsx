"use client";

import type { ReactNode } from "react";
import { CheckIcon, ExternalLinkIcon } from "lucide-react";
import { toast } from "sonner";
import { CurrencyLogo } from "./currency-logo";
import type { ToastAsset, ToastTransaction } from "./trade-toast-details";
import { formatDisplayAmount } from "@/lib/token-display";
import { getExplorerUrl } from "@/lib/utils";
import styles from "./swap-success-toast.module.css";

type SwapSuccessToastOptions = {
  id: string;
  input?: ToastAsset;
  output?: ToastAsset;
  message?: ReactNode;
  chainId?: number;
  transactions?: ToastTransaction[];
};

function AssetRow({ asset, label }: { asset: ToastAsset; label: string }) {
  return <div className={styles.asset} data-swap-success-asset={label.toLowerCase()}>
    <CurrencyLogo symbol={asset.token.symbol} name={asset.token.name} logoUrl={asset.token.logoUrl}
      className="size-6 shrink-0" fallbackClassName="text-[9px]" />
    <span className={styles.label}>{label}</span>
    <span className={styles.amount} translate="no">
      <span data-raw-amount={asset.amount}>{formatDisplayAmount(asset.amount) || "—"}</span>{" "}
      <span className={styles.symbol}>{asset.token.symbol ?? "Token"}</span>
    </span>
  </div>;
}

function SwapSuccessDetails({ input, output, message, chainId, transactions = [] }: Omit<SwapSuccessToastOptions, "id">) {
  const uniqueTransactions = transactions.filter((transaction, index) => transaction.hash &&
    transactions.findIndex(candidate => candidate.hash.toLowerCase() === transaction.hash.toLowerCase()) === index);
  const explorerTransactions = uniqueTransactions.flatMap(transaction => {
    const href = getExplorerUrl(chainId, transaction.hash);
    return href ? [{ ...transaction, href }] : [];
  });

  return <div className={styles.details} data-swap-success-details>
    {(input || output) && <div className={styles.assets} role="group" aria-label="Completed swap amounts">
      {input && <AssetRow asset={input} label="Paid" />}
      {output && <AssetRow asset={output} label="Received" />}
    </div>}
    {message && <div className={styles.message}>{message}</div>}
    {explorerTransactions.length > 0 && <div className={styles.transactions}>
      {explorerTransactions.map(({ label, hash, href }) => <a key={hash} href={href} target="_blank" rel="noopener noreferrer"
        className={styles.explorer} aria-label={`View ${label.toLowerCase()} on explorer`} title={label} data-toast-transaction>
        {explorerTransactions.length === 1 ? "View on explorer" : `${label.replace(/\s+transaction$/i, "")} explorer`}
        <ExternalLinkIcon aria-hidden="true" className="size-3 shrink-0" />
      </a>)}
    </div>}
  </div>;
}

/** Update the submission's existing native toast without changing its lifecycle. */
export function showSwapSuccessToast({ id, ...details }: SwapSuccessToastOptions): string | number {
  return toast.success("Swap completed", {
    id,
    duration: 20_000,
    closeButton: true,
    icon: <CheckIcon aria-hidden="true" className="size-4" strokeWidth={2} />,
    description: <SwapSuccessDetails {...details} />,
    classNames: {
      toast: styles.toast,
      title: styles.title,
      description: styles.description,
      icon: styles.icon,
      closeButton: styles.closeButton,
    },
  });
}
