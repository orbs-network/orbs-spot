import { DeveloperGuideLink } from "./developer-guide-link";
import { getSpotDocsHref } from "@/lib/developer-docs";

export function OrdersSinkGuideLink({
  className,
  section,
}: {
  className?: string;
  section?: string;
}) {
  return (
    <DeveloperGuideLink
      baseHref={getSpotDocsHref("/advanced-orders/direct")}
      className={className}
      section={section}
    />
  );
}
