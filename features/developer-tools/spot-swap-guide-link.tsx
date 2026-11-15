import { DeveloperGuideLink } from "./developer-guide-link";

export function SpotSwapGuideLink({
  className,
}: {
  className?: string;
  section?: string;
}) {
  return (
    <DeveloperGuideLink
      baseHref="https://github.com/orbs-network/spot-ui/blob/master/skills/spot-swap-integration/references/02-swap-flow.md"
      className={className}
      section={undefined}
    />
  );
}
