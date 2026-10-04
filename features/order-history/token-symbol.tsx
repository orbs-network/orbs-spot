export function TokenSymbol({ symbol, isLoading }: { symbol?: string; isLoading: boolean }) {
  if (isLoading) {
    return <span data-slot="skeleton" role="status" aria-label="Loading token symbol" className="inline-block h-4 w-14 shrink-0 animate-pulse bg-muted-foreground/20 align-middle motion-reduce:animate-none" />;
  }
  return symbol || "Unknown token";
}
