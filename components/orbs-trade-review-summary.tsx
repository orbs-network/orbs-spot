import { ArrowDownIcon } from "lucide-react";
import type { Currency } from "@/lib/types";
import { SwapFlowTokenLogo } from "./ui/swap-flow-token-logo";

type ReviewAsset = {
  currency?: Currency;
  token?: { symbol?: string; name?: string; logoUrl?: string };
  amount?: string;
  usd?: string;
};

function ReviewAssetRow({ asset, label }: { asset: ReviewAsset; label: string }) {
  const symbol = asset.currency?.symbol ?? asset.token?.symbol ?? "Token";
  return (
    <div data-review-asset role="group" aria-label={label}>
      <div data-review-asset-values>
        <div data-review-asset-amount>
          <p><span>{asset.amount || "—"}</span>{" "}<span data-review-asset-symbol>{symbol}</span></p>
          <span>{asset.usd ? `$${asset.usd}` : "USD value unavailable"}</span>
        </div>
      </div>
      <div data-review-asset-icon>
        <SwapFlowTokenLogo currency={asset.currency} token={asset.token} className="size-11" />
      </div>
    </div>
  );
}

export function OrbsTradeReviewSummary({ pay, receive }: { pay: ReviewAsset; receive: ReviewAsset }) {
  return (
    <section data-orbs-trade-summary aria-label="Trade amounts">
      <ReviewAssetRow asset={pay} label="You pay" />
      <div data-review-direction aria-hidden="true"><ArrowDownIcon className="size-[18px]" /></div>
      <ReviewAssetRow asset={receive} label="You receive · estimated" />
    </section>
  );
}
