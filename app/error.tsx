"use client";

import { Button } from "@/components/ui/button";

export default function TradingError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section role="alert" className="my-auto flex max-w-md flex-col items-center gap-4 border border-border bg-card p-8 text-center">
      <h1 className="text-xl">Trading view could not load</h1>
      <p className="text-sm text-muted-foreground">Try loading the view again. If you submitted a transaction, check your wallet activity before retrying it.</p>
      <Button onClick={reset}>Reload trading view</Button>
    </section>
  );
}
