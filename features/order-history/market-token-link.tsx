import { SUPPORTED_CHAINS } from "@/lib/consts";
import { cn, isNativeAddress } from "@/lib/utils";
import { TokenSymbol } from "./token-symbol";

export function MarketTokenLink({ address, chainId, symbol, isLoading, className }: {
  address: string;
  chainId: number;
  symbol?: string;
  isLoading: boolean;
  className?: string;
}) {
  const explorer = SUPPORTED_CHAINS.find(chain => chain.id === chainId)?.blockExplorers?.default;
  const label = symbol || "token";

  if (!explorer) return <span className={cn("text-[13px] font-semibold", className)}><TokenSymbol symbol={symbol} isLoading={isLoading} /></span>;

  return (
    <a
      href={isNativeAddress(address) ? explorer.url : `${explorer.url}/token/${address}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`View ${label} on ${explorer.name} (opens in a new tab)`}
      className={cn("text-[13px] font-semibold text-foreground underline-offset-4 hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary", className)}
    >
      <TokenSymbol symbol={symbol} isLoading={isLoading} />
    </a>
  );
}
