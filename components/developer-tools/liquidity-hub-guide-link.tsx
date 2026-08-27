import { DeveloperGuideLink } from "./developer-guide-link";

export function LiquidityHubGuideLink({
  className,
  section,
}: {
  className?: string;
  section?: string;
}) {
  return (
    <DeveloperGuideLink
      baseHref="/developers/liquidity-hub"
      className={className}
      section={section}
    />
  );
}
