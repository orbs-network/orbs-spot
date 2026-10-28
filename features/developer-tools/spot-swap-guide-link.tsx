import { DeveloperGuideLink } from "./developer-guide-link";

export function SpotSwapGuideLink({
  className,
}: {
  className?: string;
  section?: string;
}) {
  return (
    <DeveloperGuideLink
      baseHref="https://github.com/orbs-network/spot-ui/blob/master/skills/spot-integration/references/07-swap-and-migration.md"
      className={className}
      section={undefined}
    />
  );
}
