import { DeveloperGuideLink } from "./developer-guide-link";

export function OrdersSinkGuideLink({
  className,
  section,
}: {
  className?: string;
  section?: string;
}) {
  return (
    <DeveloperGuideLink
      baseHref="/developers/orders-sink/direct"
      className={className}
      section={section}
    />
  );
}
