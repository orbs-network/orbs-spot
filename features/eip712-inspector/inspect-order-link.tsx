"use client";

import { useState } from "react";
import { ExternalLinkIcon } from "lucide-react";
import { toast } from "sonner";
import { INSPECTOR_PATH, saveDraft, type InspectorDraft } from "./handoff";
import { preserveDeveloperModeInHref, useDeveloperMode } from "@/lib/hooks/use-developer-mode";

export function InspectOrderLink({
  getDraft,
}: {
  getDraft: () => InspectorDraft;
}) {
  const [href, setHref] = useState(INSPECTOR_PATH);
  const { isDeveloperMode } = useDeveloperMode();
  if (!isDeveloperMode) return null;
  return (
    <a
      href={preserveDeveloperModeInHref(href, isDeveloperMode)}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      onClick={(event) => {
        try {
          const url = preserveDeveloperModeInHref(saveDraft(getDraft()), isDeveloperMode);
          event.currentTarget.href = url;
          setHref(url);
        } catch {
          event.preventDefault();
          toast.error("Could not open order preview", {
            description: "Allow browser storage, then try again.",
          });
        }
      }}
    >
      Preview order <ExternalLinkIcon aria-hidden="true" className="size-3.5" />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}
