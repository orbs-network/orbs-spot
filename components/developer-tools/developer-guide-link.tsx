import Link from "next/link";
import type { ReactNode } from "react";
import { ExternalLinkIcon } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import {
  preserveFormTabInHref,
  useSelectedFormTab,
} from "@/lib/hooks/use-form-tab";
import { cn } from "@/lib/utils";
import {
  preserveDeveloperModeInHref,
  useDeveloperMode,
} from "./use-developer-mode";

export function DeveloperGuideLink({
  baseHref,
  children = "Open Full Guide",
  className,
  section,
}: {
  baseHref: string;
  children?: ReactNode;
  className?: string;
  section?: string;
}) {
  const { isDeveloperMode } = useDeveloperMode();
  const { selectedTab } = useSelectedFormTab();
  const href = preserveDeveloperModeInHref(
    preserveFormTabInHref(
      `${baseHref}${section ? `#${section}` : ""}`,
      selectedTab.value,
    ),
    isDeveloperMode,
  );

  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        buttonVariants({ variant: "outline" }),
        "cursor-pointer",
        className,
      )}
    >
      {children}
      <ExternalLinkIcon aria-hidden="true" className="size-3.5" />
    </Link>
  );
}
