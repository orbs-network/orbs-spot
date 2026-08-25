import Link from "next/link";
import { ExternalLinkIcon } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  preserveDeveloperModeInHref,
  useDeveloperMode,
} from "./use-developer-mode";

export function OrdersSinkGuideLink({
  className,
  section,
}: {
  className?: string;
  section?: string;
}) {
  const { isDeveloperMode } = useDeveloperMode();
  const href = preserveDeveloperModeInHref(
    `/developers/orders-sink${section ? `#${section}` : ""}`,
    isDeveloperMode,
  );

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
