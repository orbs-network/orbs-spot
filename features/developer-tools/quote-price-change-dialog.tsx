"use client";

import { formatUnits } from "viem";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

export function QuotePriceChangeDialog({
  previousMinimum,
  newMinimum,
  outputDecimals,
  outputSymbol,
  onAccept,
  onClose,
}: {
  previousMinimum: string;
  newMinimum: string;
  outputDecimals?: number;
  outputSymbol?: string;
  onAccept: () => void;
  onClose: () => void;
}) {
  const formatAmount = (amount: string) => outputDecimals === undefined
    ? `${amount} base units`
    : `${formatUnits(BigInt(amount), outputDecimals)} ${outputSymbol ?? ""}`.trim();

  return (
    <Dialog open responsive={false} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent presentation="center" className="max-w-md" aria-describedby="quote-price-change-description">
        <DialogTitle>Approve the new price</DialogTitle>
        <p id="quote-price-change-description" className="text-sm text-muted-foreground">
          The price has changed. Review the minimum you will receive for the same input amount before signing.
        </p>
        <dl className="grid gap-4 rounded-lg border p-4">
          <div className="grid gap-1">
            <dt className="text-sm text-muted-foreground">Old price · minimum received</dt>
            <dd className="break-all font-medium tabular-nums">{formatAmount(previousMinimum)}</dd>
          </div>
          <div className="grid gap-1">
            <dt className="text-sm text-muted-foreground">New price · minimum received</dt>
            <dd className="break-all font-medium tabular-nums">{formatAmount(newMinimum)}</dd>
          </div>
        </dl>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={onAccept}>Accept</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
