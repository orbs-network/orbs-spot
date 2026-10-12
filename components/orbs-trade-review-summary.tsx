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

function ReviewAssetRow({ asset, label, layout }: { asset: ReviewAsset; label: string; layout: "swap" | "order" }) {
  const symbol = asset.currency?.symbol ?? asset.token?.symbol ?? "Token";
  return (
    <div data-review-asset role="group" aria-label={asset.label ?? label}>
      <div data-review-asset-values>
        {layout === "order" && <p data-review-asset-label>{label}</p>}
        <div data-review-asset-amount>
          <p><span>{asset.amount || "—"}</span>{" "}<span data-review-asset-symbol>{symbol}</span></p>
          <span>{asset.caption ?? (asset.usd || "USD value unavailable")}</span>
        </div>
      </div>
      {asset.icon !== null && <div data-review-asset-icon>
        {asset.icon ?? <SwapFlowTokenLogo currency={asset.currency} token={asset.token} className="size-11" />}
      </div>}
    </div>
  );
}

export function OrbsTradeReviewSummary({ pay, receive, layout = "swap" }: { pay: ReviewAsset; receive: ReviewAsset; layout?: "swap" | "order" }) {
  return (
    <section data-orbs-trade-summary className={layout === "order" ? styles.orderSummary : undefined} aria-label="Trade amounts">
      <ReviewAssetRow asset={pay} label={layout === "order" ? "Sell" : "You pay"} layout={layout} />
      {layout === "swap" && <div data-review-direction aria-hidden="true"><ArrowDownIcon className="size-[18px]" /></div>}
      <ReviewAssetRow asset={receive} label={layout === "order" ? "Buy" : "You receive · estimated"} layout={layout} />
    </section>
  );
}
