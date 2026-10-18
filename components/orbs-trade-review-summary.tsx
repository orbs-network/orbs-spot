import type { ReactNode } from "react";
import { ArrowDownIcon } from "lucide-react";
import type { Currency } from "@/lib/types";
import { SwapFlowTokenLogo } from "./ui/swap-flow-token-logo";
import styles from "./orbs-trade-review-summary.module.css";

type ReviewAsset = {
  currency?: Currency;
  token?: { symbol?: string; name?: string; logoUrl?: string };
  amount?: string;
  usd?: string;
  caption?: ReactNode;
  label?: string;
  icon?: ReactNode;
};
export type TradeReviewLayout = "review" | "submission";

function ReviewAssetRow({ asset, label }: { asset: ReviewAsset; label: string }) {
  const symbol = asset.currency?.symbol ?? asset.token?.symbol ?? "Token";
  return (
    <div data-review-asset role="group" aria-label={asset.label ?? label}>
      <div data-review-asset-values>
        <p data-review-asset-label>{asset.label ?? label}</p>
        <div data-review-asset-amount>
          <p><span>{asset.amount || "—"}</span>{" "}<span data-review-asset-symbol>{symbol}</span></p>
          <span>{asset.caption ?? (asset.usd || "USD value unavailable")}</span>
        </div>
      </div>
      {asset.icon !== null && <div data-review-asset-icon>
        {asset.icon ?? <SwapFlowTokenLogo currency={asset.currency} token={asset.token} className="size-full" />}
      </div>}
    </div>
  );
}

export function OrbsTradeReviewSummary({ pay, receive, layout = "review" }: { pay: ReviewAsset; receive: ReviewAsset; layout?: TradeReviewLayout }) {
  return (
    <section data-orbs-trade-summary className={layout === "submission" ? styles.submissionSummary : undefined} aria-label="Trade amounts">
      <ReviewAssetRow asset={pay} label="From" />
      <div data-review-direction aria-hidden="true"><ArrowDownIcon className="size-[18px]" /></div>
      <ReviewAssetRow asset={receive} label="To" />
    </section>
  );
}
