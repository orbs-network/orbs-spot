import { DeveloperGuideLink } from "./developer-guide-link";
import { getSpotDocsHref } from "@/features/developer-tools/docs";

export function LiquidityHubGuideLink({
  className,
  section,
}: {
  className?: string;
  section?: string;
}) {
  return (
    <DeveloperGuideLink
      baseHref={getSpotDocsHref("/liquidity-hub")}
      className={className}
      section={section}
    />
  );
}
