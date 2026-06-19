import { CurrencyLogo } from "./currency-logo";

export function SwapFlowTokenLogo({
  token,
}: {
  token?: {
    logoUrl?: string;
    symbol?: string;
  };
}) {
  return (
    <CurrencyLogo
      symbol={token?.symbol}
      logoUrl={token?.logoUrl}
      className="token-logo"
    />
  );
}
