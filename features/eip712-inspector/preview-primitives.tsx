"use client";

import { useState, type ReactNode } from "react";
import { InfoIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function HelpTip({
  label,
  children,
  trigger,
}: {
  label: string;
  children: ReactNode;
  trigger?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          onClick={() => setOpen(true)}
          className="inline-flex min-h-8 min-w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none"
        >
          {trigger ?? <InfoIcon aria-hidden="true" className="size-3.5" />}
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-[min(320px,calc(100vw-2rem))] p-3 text-left leading-relaxed motion-reduce:animate-none">
        {children}
      </TooltipContent>
    </Tooltip>
  );
}

export function HelpLabel({ label, hint }: { label: string; hint?: string }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1">
      <span>{label}</span>
      {hint && <HelpTip label={`About ${label}`}>{hint}</HelpTip>}
    </span>
  );
}

export function TokenAddress({ address }: { address: unknown }) {
  const value = String(address);
  return (
    <HelpTip
      label={`Token contract ${value}`}
      trigger={<span className="font-mono text-[11px]">{value.slice(0, 6)}…{value.slice(-4)}</span>}
    >
      <span className="block text-muted-foreground">Token contract</span>
      <span className="mt-1 block break-all font-mono">{value}</span>
    </HelpTip>
  );
}

export function LoadingValue({
  loading,
  children,
  className = "h-5 w-36 sm:ml-auto",
}: {
  loading: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div aria-busy={loading}>
      {loading ? (
        <>
          <Skeleton aria-hidden="true" className={`${className} max-w-full bg-muted/60 motion-reduce:animate-none`} />
          <span className="sr-only">Loading amount</span>
        </>
      ) : children}
    </div>
  );
}
