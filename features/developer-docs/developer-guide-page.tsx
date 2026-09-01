import { DeveloperGuideShell } from "./developer-guide-shell";
import { loadDeveloperGuides } from "./guide-content";
import type { DeveloperGuideId } from "./guide-types";

export function DeveloperGuidePage({
  activeGuideId,
}: {
  activeGuideId: DeveloperGuideId;
}) {
  return (
    <DeveloperGuideShell
      activeGuideId={activeGuideId}
      guides={loadDeveloperGuides()}
    />
  );
}
