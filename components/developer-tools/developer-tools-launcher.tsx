"use client";

import { lazy, Suspense, type ReactElement, useState } from "react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const DeveloperToolsModal = lazy(async () => ({
  default: (await import("./developer-tools-modal")).DeveloperToolsModal,
}));

export function DeveloperToolsLauncher({
  trigger,
  triggerTooltip = "Open developer tools",
}: {
  trigger: ReactElement;
  triggerTooltip?: string;
}) {
  const [loaded, setLoaded] = useState(false);

  if (!loaded) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex" onClick={() => setLoaded(true)}>
            {trigger}
          </span>
        </TooltipTrigger>
        <TooltipContent>{triggerTooltip}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Suspense fallback={<span className="inline-flex">{trigger}</span>}>
      <DeveloperToolsModal
        initiallyOpen
        trigger={trigger}
        triggerTooltip={triggerTooltip}
      />
    </Suspense>
  );
}
