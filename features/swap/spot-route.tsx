import Image from "next/image";
import { DetailRow } from "@/components/ui/detail-row";

export function SpotRoute() {
  return (
    <DetailRow
      label="Route"
      tooltip="Swaps use signed Orbs Spot orders and complete when the order is filled."
      value={
        <span className="inline-flex max-w-full items-center justify-end gap-1.5">
          <Image src="/orbs-logo.svg" alt="" aria-hidden="true" width={16} height={16} className="size-4 shrink-0" />
          <span>Orbs Spot</span>
        </span>
      }
    />
  );
}
