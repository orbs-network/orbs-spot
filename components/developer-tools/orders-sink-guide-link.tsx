import Link from "next/link";
import { ExternalLinkIcon } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function OrdersSinkGuideLink({
  className,
  section,
}: {
  className?: string;
  section?: string;
}) {
  const href = `/developers/orders-sink${section ? `#${section}` : ""}`;

  return (
    <Link
      href={href}
      target="_blank"
      rel="noreferrer"
      className={cn(
        buttonVariants({ variant: "outline" }),
        "cursor-pointer",
        className,
      )}
    >
      Open full guide
      <ExternalLinkIcon className="size-3.5" />
    </Link>
  );
}
