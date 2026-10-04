import { DeveloperGuideLink } from "./developer-guide-link";
import { getSpotDocsHref } from "@/features/developer-tools/docs";

export function OrdersSinkGuideLink({
  className,
  section,
}: {
  className?: string;
  section?: string;
}) {
  return (
    <DeveloperGuideLink
      baseHref={getSpotDocsHref("/advanced-orders/typescript")}
      className={className}
      section={section}
    />
  );
}
