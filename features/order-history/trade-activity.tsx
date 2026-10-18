"use client";

import { OrderRate } from "./order-rate";

import { useState } from "react";
import { OrderStatus } from "@orbs-network/spot-ui";
import { ChevronLeftIcon, ChevronRightIcon, ExternalLinkIcon, Clock3Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getExplorerUrl } from "@/lib/utils";
import { formatOrderAmount, formatDetailDate, type DerivedHistoryOrder } from "./format";
import styles from "./order-page.module.css";

export function TradeActivity({ details }: { details: DerivedHistoryOrder }) {
  const [requestedPage, setPage] = useState(0);
  const perPage = 5;
  const pageCount = Math.max(1, Math.ceil(details.fills.length / perPage));
  const page = Math.min(requestedPage, pageCount - 1);
  // Fills are chronological; preserve that order across pages too.
  const start = page * perPage;
  const fills = details.fills.slice(start, start + perPage);
  return <section className={styles.section} aria-label="Filled trades">
    {fills.length ? <ol className={styles.fills} aria-label="Completed trades">
      {fills.map((fill, index) => {
        const number = start + index + 1;
        const explorerUrl = fill.txHash ? getExplorerUrl(details.original.chainId, fill.txHash) : undefined;
        return <li key={`${fill.txHash}-${fill.timestamp}-${number}`} className={styles.fill}>
          <div className={styles.fillContent}>
            <div className={styles.fillHeading}>
              <h3>Trade {number}
                {fill.txHash && (explorerUrl
                  ? <a href={explorerUrl} target="_blank" rel="noopener noreferrer" className={styles.transactionLink} aria-label={`View transaction for trade ${number} (opens in a new tab)`}><span>Tx hash</span><ExternalLinkIcon aria-hidden="true" className="size-3.5 shrink-0" /></a>
                  : <span className={styles.identifier}>Tx hash</span>)}
              </h3>
              <p className={styles.caption}>{formatDetailDate(fill.timestamp)}</p>
            </div>
            <dl data-fill-amounts className={styles.fillAmounts}>
              <div><dt>Sold</dt><dd title={fill.inputAmount.ui}>{formatOrderAmount(fill.inputAmount.ui, details.inputToken)} <span>{details.inputToken?.symbol}</span></dd></div>
              <div><dt>Received</dt><dd title={fill.outputAmount.ui}>{formatOrderAmount(fill.outputAmount.ui, details.outputToken)} <span>{details.outputToken?.symbol}</span></dd></div>
            </dl>
            <dl data-fill-rate className={styles.fillRate}>
              <dt>Execution rate</dt>
              <dd>{<OrderRate value={fill.executionRate} inputSymbol={details.inputToken?.symbol} outputSymbol={details.outputToken?.symbol} />}</dd>
            </dl>
          </div>
        </li>;
      })}
    </ol> : <div className={styles.emptyActivity}>
      <Clock3Icon aria-hidden="true" className="size-6 text-muted-foreground" />
      <p>No trades filled yet</p>
      <span className={styles.caption}>{details.original.status === OrderStatus.Open ? "Completed trades and transaction links will appear here." : "This order closed without any trades being filled."}</span>
    </div>}
    {pageCount > 1 && <nav aria-label="Trade activity pages" className={styles.pagination}>
      <span role="status" className={styles.caption}>{page * perPage + 1}–{Math.min((page + 1) * perPage, details.fills.length)} of {details.fills.length} trades</span>
      <div className="flex gap-2">
        <Button variant="outline" size="icon" className="size-11" aria-label="Older trades" disabled={page === 0} onClick={() => setPage(page - 1)}><ChevronLeftIcon aria-hidden="true" /></Button>
        <Button variant="outline" size="icon" className="size-11" aria-label="Newer trades" disabled={page >= pageCount - 1} onClick={() => setPage(page + 1)}><ChevronRightIcon aria-hidden="true" /></Button>
      </div>
    </nav>}
  </section>;
}
